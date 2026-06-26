from sqlalchemy.orm import Session
from app.models.notification import Notification
from app.models.comment import Comment


def get_comment_participants(db: Session, sighting_id: int) -> set[int]:
    """해당 게시글에 댓글을 단 사용자 ID 목록 (중복 제거)"""
    results = (
        db.query(Comment.user_id)
        .filter(
            Comment.sighting_id == sighting_id,
            Comment.is_deleted == False,
        )
        .distinct()
        .all()
    )
    return {row[0] for row in results}


def create_notification(
    db: Session,
    user_id: int,
    notification_type: str,
    message: str,
    actor_id: int | None = None,
    sighting_id: int | None = None,
    comment_id: int | None = None,
):
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        sighting_id=sighting_id,
        comment_id=comment_id,
        actor_id=actor_id,
        message=message,
        is_read=False,
    )
    db.add(notification)


def create_notifications(
    db: Session,
    recipients: set[int],
    exclude_user_id: int,
    notification_type: str,
    sighting_id: int,
    message: str,
    actor_id: int,
    comment_id: int | None = None,
):
    """여러 사용자에게 알림을 생성 (자기 자신 제외)"""
    for user_id in recipients:
        if user_id == exclude_user_id:
            continue

        create_notification(
            db=db,
            user_id=user_id,
            notification_type=notification_type,
            sighting_id=sighting_id,
            message=message,
            actor_id=actor_id,
            comment_id=comment_id,
        )