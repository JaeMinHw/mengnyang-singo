from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.keyword import KeywordSubscription
from app.models.user import User
from app.schemas.keyword import KeywordCreate, KeywordResponse

router = APIRouter()


@router.get("/keywords", response_model=List[KeywordResponse])
def get_my_keywords(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keywords = (
        db.query(KeywordSubscription)
        .filter(
            KeywordSubscription.user_id == current_user.id,
            KeywordSubscription.is_active == True,
        )
        .order_by(KeywordSubscription.created_at.desc())
        .all()
    )

    return keywords


@router.post(
    "/keywords",
    response_model=KeywordResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_keyword(
    data: KeywordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keyword_text = data.keyword.strip()

    if not keyword_text:
        raise HTTPException(status_code=400, detail="키워드를 입력해주세요")

    if len(keyword_text) > 100:
        raise HTTPException(status_code=400, detail="키워드는 100자 이내로 입력해주세요")

    # 중복 체크
    existing = (
        db.query(KeywordSubscription)
        .filter(
            KeywordSubscription.user_id == current_user.id,
            KeywordSubscription.keyword == keyword_text,
            KeywordSubscription.is_active == True,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="이미 등록된 키워드입니다")

    # 최대 개수 제한
    count = (
        db.query(KeywordSubscription)
        .filter(
            KeywordSubscription.user_id == current_user.id,
            KeywordSubscription.is_active == True,
        )
        .count()
    )

    if count >= 20:
        raise HTTPException(status_code=400, detail="키워드는 최대 20개까지 등록할 수 있습니다")

    keyword = KeywordSubscription(
        user_id=current_user.id,
        keyword=keyword_text,
    )

    db.add(keyword)
    db.commit()
    db.refresh(keyword)

    return keyword


@router.delete(
    "/keywords/{keyword_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_keyword(
    keyword_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    keyword = db.query(KeywordSubscription).filter(
        KeywordSubscription.id == keyword_id,
        KeywordSubscription.user_id == current_user.id,
    ).first()

    if not keyword:
        raise HTTPException(status_code=404, detail="키워드를 찾을 수 없습니다")

    keyword.is_active = False
    db.commit()