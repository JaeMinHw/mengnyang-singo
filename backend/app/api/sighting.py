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
from app.models.sighting_image import SightingImage

from app.models.keyword import KeywordSubscription
from app.models.notification import Notification
from app.core.notifications import (
    get_comment_participants,
    create_notifications,
    create_notification,
)
from app.core.similar_sightings import find_similar_sightings

router = APIRouter()

def get_post_type_label(post_type: str) -> str:
    return "실종 글" if post_type == "LOST" else "목격 글"


def format_distance_label(distance_meters: float) -> str:
    if distance_meters < 1000:
        return f"{round(distance_meters)}m"
    return f"{distance_meters / 1000:.1f}km"


def create_similar_match_notifications(
    db: Session,
    new_sighting: Sighting,
    current_user: User,
) -> None:
    matches = find_similar_sightings(
        db=db,
        base_sighting=new_sighting,
        exclude_user_id=current_user.id,
    )

    if not matches:
        return

    new_post_label = get_post_type_label(new_sighting.post_type)
    notified_candidate_users: set[int] = set()

    for match in matches:
        candidate = match.sighting
        candidate_post_label = get_post_type_label(candidate.post_type)
        distance_label = format_distance_label(match.distance_meters)

        feature_suffix = ""
        if match.matched_features:
            feature_suffix = f" (공통 특징: {', '.join(match.matched_features[:2])})"

        # 1) 새 글 작성자에게: 기존 매칭 글 알림
        create_notification(
            db=db,
            user_id=current_user.id,
            notification_type="SIMILAR_MATCH",
            sighting_id=candidate.id,
            actor_id=candidate.user_id,
            message=(
                f"등록한 {new_post_label}과 유사한 {candidate_post_label}이 "
                f"약 {distance_label} 거리에서 확인되었습니다.{feature_suffix}"
            ),
        )

        # 2) 기존 글 작성자에게: 새 글 알림 (같은 사용자 중복 방지)
        if candidate.user_id in notified_candidate_users:
            continue

        create_notification(
            db=db,
            user_id=candidate.user_id,
            notification_type="SIMILAR_MATCH",
            sighting_id=new_sighting.id,
            actor_id=current_user.id,
            message=(
                f"내 {candidate_post_label}과 유사한 새 {new_post_label}이 "
                f"약 {distance_label} 거리에서 등록되었습니다.{feature_suffix}"
            ),
        )
        notified_candidate_users.add(candidate.user_id)

    db.commit()

def normalize_image_urls(
    image_urls: Optional[List[str]],
    image_url: Optional[str],
) -> List[str]:
    if image_urls is not None:
        raw_urls = image_urls
    elif image_url:
        raw_urls = [image_url]
    else:
        raw_urls = []

    normalized: List[str] = []
    seen = set()

    for raw_url in raw_urls:
        if not raw_url:
            continue

        cleaned = raw_url.strip()
        if not cleaned:
            continue

        if cleaned in seen:
            continue

        seen.add(cleaned)
        normalized.append(cleaned)

    return normalized


def apply_sighting_images(sighting: Sighting, image_urls: List[str]) -> None:
    sighting.images = [
        SightingImage(image_url=url, sort_order=index)
        for index, url in enumerate(image_urls)
    ]
    sighting.image_url = image_urls[0] if image_urls else None


def get_sighting_image_urls(sighting: Sighting) -> List[str]:
    if sighting.images:
        return [image.image_url for image in sighting.images if image.image_url]

    if sighting.image_url:
        return [sighting.image_url]

    return []

def sighting_to_response(sighting: Sighting) -> dict:
    image_urls = get_sighting_image_urls(sighting)

    return {
        "id": sighting.id,
        "user_id": sighting.user_id,
        "user_nickname": sighting.user.nickname if sighting.user else None,
        "animal_type": sighting.animal_type,
        "description": sighting.description,
        "image_url": image_urls[0] if image_urls else None,
        "image_urls": image_urls,
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

    image_urls = normalize_image_urls(
        sighting_data.pop("image_urls", None),
        sighting_data.get("image_url"),
    )
    sighting_data["image_url"] = image_urls[0] if image_urls else None

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
    apply_sighting_images(sighting, image_urls)

    db.commit()
    db.refresh(sighting)

    search_text = " ".join(
        filter(None, [sighting.address, sighting.description])
    ).lower()

    if search_text:
        all_keywords = (
            db.query(KeywordSubscription)
            .filter(KeywordSubscription.is_active == True)
            .all()
        )

        notified_users: set[int] = set()

        for kw in all_keywords:
            if kw.user_id == current_user.id:
                continue

            if kw.user_id in notified_users:
                continue

            if kw.keyword.lower() in search_text:
                notification = Notification(
                    user_id=kw.user_id,
                    type="KEYWORD_MATCH",
                    sighting_id=sighting.id,
                    comment_id=None,
                    actor_id=current_user.id,
                    message=f"관심 키워드 '{kw.keyword}'와 일치하는 새 글이 등록되었습니다.",
                    is_read=False,
                )
                db.add(notification)
                notified_users.add(kw.user_id)

        if notified_users:
            db.commit()
        # 유사 글 매칭 알림 (양방향)
    create_similar_match_notifications(
        db=db,
        new_sighting=sighting,
        current_user=current_user,
    )
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

    has_image_urls = "image_urls" in update_data
    has_image_url = "image_url" in update_data

    incoming_image_urls = update_data.pop("image_urls", None) if has_image_urls else None
    incoming_image_url = update_data.pop("image_url", None) if has_image_url else None

    for field, value in update_data.items():
        setattr(sighting, field, value)

    if has_image_urls:
        normalized_image_urls = normalize_image_urls(incoming_image_urls, None)
        apply_sighting_images(sighting, normalized_image_urls)
    elif has_image_url:
        normalized_image_urls = normalize_image_urls(None, incoming_image_url)
        apply_sighting_images(sighting, normalized_image_urls)

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


