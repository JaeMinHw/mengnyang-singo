from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.sighting import Sighting
from app.models.user import User
from app.schemas.sighting import SightingCreate, SightingResponse, SightingStatusUpdate


router = APIRouter()


def sighting_to_response(sighting: Sighting) -> dict:
    """Sighting ORM 객체를 응답용 dict로 변환 (닉네임 포함)"""
    return {
        "id": sighting.id,
        "user_id": sighting.user_id,
        "user_nickname": sighting.user.nickname if sighting.user else None,
        "animal_type": sighting.animal_type,
        "description": sighting.description,
        "image_url": sighting.image_url,
        "latitude": sighting.latitude,
        "longitude": sighting.longitude,
        "address": sighting.address,
        "status": sighting.status,
        "post_type": sighting.post_type,
        "created_at": sighting.created_at,
        "updated_at": sighting.updated_at,
    }


@router.post("/sightings", response_model=SightingResponse)
def create_sighting(
    data: SightingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting_data = data.model_dump()

    # post_type에 따라 기본 상태 설정
    if sighting_data.get("post_type") == "LOST":
        default_status = "LOST"
    else:
        default_status = "SPOTTED"

    sighting = Sighting(
        **sighting_data,
        user_id=current_user.id,
        status=default_status,
    )
    db.add(sighting)
    db.commit()
    db.refresh(sighting)
    return sighting_to_response(sighting)

@router.patch("/sightings/{sighting_id}/status", response_model=SightingResponse)
def update_sighting_status(
    sighting_id: int,
    data: SightingStatusUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다")

    if sighting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 신고만 상태를 변경할 수 있습니다")

    allowed_statuses_by_post_type = {
        "SIGHTING": {"SPOTTED", "PROTECTING", "FOUND"},
        "LOST": {"LOST", "PROTECTING", "FOUND"},
    }

    allowed_statuses = allowed_statuses_by_post_type.get(sighting.post_type, set())

    if data.status not in allowed_statuses:
        if sighting.post_type == "LOST":
            raise HTTPException(
                status_code=400,
                detail="실종 글은 실종, 보호 중, 찾음 상태로만 변경할 수 있습니다",
            )
        raise HTTPException(
            status_code=400,
            detail="목격 글은 목격, 보호 중, 찾음 상태로만 변경할 수 있습니다",
        )

    sighting.status = data.status
    db.commit()
    db.refresh(sighting)

    return sighting_to_response(sighting)

@router.get("/sightings", response_model=List[SightingResponse])
def get_sightings(
    animal_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Sighting)

    if animal_type:
        query = query.filter(Sighting.animal_type == animal_type)
    if status:
        query = query.filter(Sighting.status == status)

    sightings = query.order_by(Sighting.created_at.desc()).all()
    return [sighting_to_response(s) for s in sightings]


@router.get("/sightings/nearby/search")
def get_nearby_sightings(
    lat: float = Query(...),
    lng: float = Query(...),
    radius: float = Query(default=0.01),
    db: Session = Depends(get_db)
):
    sightings = db.query(Sighting).filter(
        Sighting.latitude.between(lat - radius, lat + radius),
        Sighting.longitude.between(lng - radius, lng + radius)
    ).order_by(Sighting.created_at.desc()).all()

    return [sighting_to_response(s) for s in sightings]


@router.get("/sightings/{sighting_id}", response_model=SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다")
    return sighting_to_response(sighting)