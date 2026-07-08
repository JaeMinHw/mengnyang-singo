
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.notifications import get_comment_participants, create_notifications

from app.models.comment import Comment
from app.models.sighting import Sighting
from app.models.user import User
from app.schemas.comment import (
    CommentCreate,
    CommentUpdate,
    CommentResponse,
    MyCommentResponse,
    MyCommentListResponse,
)
from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
router = APIRouter()


def comment_to_response(comment: Comment) -> dict:
    """Comment ORM 객체를 응답용 dict로 변환 (닉네임 포함)"""
    return {
        "id": comment.id,
        "sighting_id": comment.sighting_id,
        "user_id": comment.user_id,
        "user_nickname": comment.user.nickname if comment.user else None,
        "content": comment.content,
        "image_url": comment.image_url,
        "created_at": comment.created_at,
        "updated_at": comment.updated_at,
    }


def comment_to_my_comment_response(comment: Comment) -> dict:
    sighting = comment.sighting

    return {
        **comment_to_response(comment),
        "sighting_animal_type": sighting.animal_type if sighting else None,
        "sighting_address": sighting.address if sighting else None,
        "sighting_status": sighting.status if sighting else None,
        "sighting_post_type": sighting.post_type if sighting else None,
        "sighting_image_url": sighting.image_url if sighting else None,
        "sighting_description": sighting.description if sighting else None,
    }


@router.post(
    "/sightings/{sighting_id}/comments",
    response_model=CommentResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_comment(
    sighting_id: int,
    data: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # 게시글 존재 확인
    sighting = db.query(Sighting).filter(
        Sighting.id == sighting_id,
        Sighting.is_deleted == False,
    ).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")

    # 내용 또는 이미지 중 하나는 있어야 함
    has_content = data.content and data.content.strip()
    has_image = data.image_url and data.image_url.strip()

    if not has_content and not has_image:
        raise HTTPException(
            status_code=400,
            detail="댓글 내용 또는 이미지를 입력해주세요",
        )

    comment = Comment(
        sighting_id=sighting_id,
        user_id=current_user.id,
        content=data.content if has_content else None,
        image_url=data.image_url if has_image else None,
    )

    db.add(comment)
    db.commit()
    db.refresh(comment)

    actor_name = current_user.nickname or "어떤 사용자"

    # 1. 글 작성자 알림
    owner_recipients = {sighting.user_id}
    create_notifications(
        db=db,
        recipients=owner_recipients,
        exclude_user_id=current_user.id,
        notification_type="NEW_COMMENT",
        sighting_id=sighting.id,
        comment_id=comment.id,
        actor_id=current_user.id,
        message=f"{actor_name}님이 회원님의 글에 댓글을 남겼습니다.",
    )

    # 2. 댓글 참여자 알림 (글 작성자는 제외해서 중복 방지)
    participant_recipients = get_comment_participants(db, sighting.id) - {sighting.user_id}
    create_notifications(
        db=db,
        recipients=participant_recipients,
        exclude_user_id=current_user.id,
        notification_type="NEW_COMMENT",
        sighting_id=sighting.id,
        comment_id=comment.id,
        actor_id=current_user.id,
        message=f"{actor_name}님이 댓글을 단 글에 새 댓글을 남겼습니다.",
    )

    db.commit()

    return comment_to_response(comment)


@router.get(
    "/sightings/{sighting_id}/comments",
    response_model=List[CommentResponse],
)
def get_comments(
    sighting_id: int,
    db: Session = Depends(get_db),
):
    # 게시글 존재 확인
    sighting = db.query(Sighting).filter(
        Sighting.id == sighting_id,
        Sighting.is_deleted == False,
    ).first()

    if not sighting:
        raise HTTPException(status_code=404, detail="글을 찾을 수 없습니다")

    comments = (
        db.query(Comment)
        .filter(
            Comment.sighting_id == sighting_id,
            Comment.is_deleted == False,
        )
        .order_by(Comment.created_at.desc())
        .all()
    )

    return [comment_to_response(c) for c in comments]

@router.get(
    "/my-comments",
    response_model=MyCommentListResponse,
)
def get_my_comments(
    days: Optional[int] = Query(None, description="최근 N일 이내"),
    limit: int = Query(10, ge=1, le=100, description="최대 조회 개수"),
    offset: int = Query(0, ge=0, description="건너뛸 개수"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = (
        db.query(Comment)
        .filter(
            Comment.user_id == current_user.id,
            Comment.is_deleted == False,
            Comment.sighting.has(Sighting.is_deleted == False),
        )
    )

    if days is not None:
        cutoff = datetime.utcnow() - timedelta(days=days)
        query = query.filter(Comment.created_at >= cutoff)

    total = query.count()

    comments = (
        query
        .order_by(Comment.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return {
        "items": [comment_to_my_comment_response(c) for c in comments],
        "total": total,
    }

@router.patch(
    "/comments/{comment_id}",
    response_model=CommentResponse,
)
def update_comment(
    comment_id: int,
    data: CommentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
        Comment.is_deleted == False,
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 수정할 수 있습니다")

    update_data = data.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(comment, field, value)

    # 수정 후에도 내용과 이미지 둘 다 비어 있으면 막기
    has_content = comment.content and comment.content.strip()
    has_image = comment.image_url and comment.image_url.strip()

    if not has_content and not has_image:
        raise HTTPException(
            status_code=400,
            detail="댓글 내용 또는 이미지를 입력해주세요",
        )

    db.commit()
    db.refresh(comment)

    return comment_to_response(comment)


@router.delete(
    "/comments/{comment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_comment(
    comment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    comment = db.query(Comment).filter(
        Comment.id == comment_id,
    ).first()

    if not comment:
        raise HTTPException(status_code=404, detail="댓글을 찾을 수 없습니다")

    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="본인이 작성한 댓글만 삭제할 수 있습니다")

    if comment.is_deleted:
        raise HTTPException(status_code=404, detail="이미 삭제된 댓글입니다")

    comment.is_deleted = True
    db.commit()