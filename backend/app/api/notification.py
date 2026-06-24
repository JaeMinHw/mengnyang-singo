from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationResponse

router = APIRouter()


def notification_to_response(notification: Notification) -> dict:
    return {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": notification.type,
        "sighting_id": notification.sighting_id,
        "comment_id": notification.comment_id,
        "actor_id": notification.actor_id,
        "actor_nickname": notification.actor.nickname if notification.actor else None,
        "message": notification.message,
        "is_read": notification.is_read,
        "created_at": notification.created_at,
    }


@router.get("/notifications", response_model=List[NotificationResponse])
def get_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )

    return [notification_to_response(n) for n in notifications]


@router.get("/notifications/unread-count")
def get_unread_count(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
        .count()
    )

    return {"count": count}


@router.patch("/notifications/{notification_id}/read")
def mark_as_read(
    notification_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id,
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")

    notification.is_read = True
    db.commit()

    return {"message": "읽음 처리되었습니다"}


@router.patch("/notifications/read-all")
def mark_all_as_read(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.is_read == False,
    ).update({"is_read": True})

    db.commit()

    return {"message": "모든 알림을 읽음 처리했습니다"}