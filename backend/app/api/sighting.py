from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.sighting import Sighting
from app.models.user import User
from app.schemas.sighting import SightingCreate, SightingResponse, SightingStatusUpdate, SightingUpdate
from app.core.notifications import get_comment_participants, create_notifications



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
        "resolved_at": sighting.resolved_at,
        "reopen_reason": sighting.reopen_reason,
        "reopen_detail": sighting.reopen_detail,
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

    previous_status = sighting.status
    next_status = data.status

    # FOUND → 활성 상태로 되돌릴 때는 사유 필수
    if previous_status == "FOUND" and next_status != "FOUND":
        if not data.reopen_reason:
            raise HTTPException(
                status_code=400,
                detail="찾음 상태를 되돌릴 때는 사유를 선택해야 합니다",
            )

        if data.reopen_reason == "OTHER":
            if not data.reopen_detail or not data.reopen_detail.strip():
                raise HTTPException(
                    status_code=400,
                    detail="기타 사유를 선택한 경우 상세 내용을 입력해야 합니다",
                )

    sighting.status = next_status

    # 활성 상태 → FOUND
    if previous_status != "FOUND" and next_status == "FOUND":
        sighting.resolved_at = datetime.utcnow()
        sighting.reopen_reason = None
        sighting.reopen_detail = None

    # FOUND → 활성 상태
    elif previous_status == "FOUND" and next_status != "FOUND":
        sighting.resolved_at = None
        sighting.reopen_reason = data.reopen_reason
        sighting.reopen_detail = (
            data.reopen_detail.strip()
            if data.reopen_reason == "OTHER" and data.reopen_detail
            else None
        )

    db.commit()
    db.refresh(sighting)

    # 상태 변경 알림: 댓글 참여자들에게 (글 작성자 본인은 제외)
    status_label = {
        "SPOTTED": "목격",
        "LOST": "실종",
        "PROTECTING": "보호 중",
        "FOUND": "찾음",
    }.get(next_status, next_status)

    participant_recipients = get_comment_participants(db, sighting.id)
    create_notifications(
        db=db,
        recipients=participant_recipients,
        exclude_user_id=current_user.id,
        notification_type="STATUS_CHANGED",
        sighting_id=sighting.id,
        comment_id=None,
        actor_id=current_user.id,
        message=f"참여한 글의 상태가 '{status_label}'(으)로 변경되었습니다.",
    )

    db.commit()

    return sighting_to_response(sighting)


@router.patch("/sightings/{sighting_id}", response_model=SightingResponse)
def update_sighting(
    sighting_id: int,
    data: SightingUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting = db.query(Sighting).filter(
        Sighting.id == sighting_id,
        Sighting.is_deleted == False,
    ).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")

    if sighting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 글만 수정할 수 있습니다")

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(sighting, field, value)

    db.commit()
    db.refresh(sighting)

    return sighting_to_response(sighting)


@router.get("/my-sightings", response_model=List[SightingResponse])
def get_my_sightings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sightings = (
        db.query(Sighting)
        .filter(
            Sighting.user_id == current_user.id,
            Sighting.is_deleted == False,
        )
        .order_by(Sighting.created_at.desc())
        .all()
    )

    return [sighting_to_response(s) for s in sightings]

@router.get("/sightings", response_model=List[SightingResponse])
def get_sightings(
    animal_type: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(Sighting)
    query = query.filter(Sighting.is_deleted == False)

    # 메인 공개 목록에서는 resolved_at 기준 30일 지난 FOUND 글 숨김
    found_hide_threshold = datetime.utcnow() - timedelta(days=30)
    query = query.filter(
        or_(
            Sighting.status != "FOUND",
            Sighting.resolved_at.is_(None),
            Sighting.resolved_at >= found_hide_threshold,
        )
    )

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
        Sighting.is_deleted == False,
        Sighting.latitude.between(lat - radius, lat + radius),
        Sighting.longitude.between(lng - radius, lng + radius)
    ).order_by(Sighting.created_at.desc()).all()

    return [sighting_to_response(s) for s in sightings]


@router.get("/sightings/{sighting_id}", response_model=SightingResponse)
def get_sighting(sighting_id: int, db: Session = Depends(get_db)):
    sighting = db.query(Sighting).filter(
        Sighting.id == sighting_id,
        Sighting.is_deleted == False,
    ).first()
    if not sighting:
        raise HTTPException(status_code=404, detail="신고를 찾을 수 없습니다")
    return sighting_to_response(sighting)


@router.delete("/sightings/{sighting_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_sighting(
    sighting_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sighting = db.query(Sighting).filter(Sighting.id == sighting_id).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")

    if sighting.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 글만 삭제할 수 있습니다")

    if sighting.is_deleted:
        raise HTTPException(status_code=404, detail="이미 삭제된 글입니다")

    sighting.is_deleted = True
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


