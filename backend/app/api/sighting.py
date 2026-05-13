from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.sighting import Sighting
from app.models.user import User
from app.schemas.sighting import SightingCreate, SightingResponse

router = APIRouter()


@router.post("/sightings", response_model=SightingResponse)
def create_sighting(
    data: SightingCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting = Sighting(**data.model_dump())
    db.add(sighting)
    db.commit()
    db.refresh(sighting)
    return sighting


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

    return query.order_by(Sighting.created_at.desc()).all()


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

    return sightings


@router.get("/sightings/{sighting_id}", response_model=SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()
    if not sighting:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다")
    return sighting