from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.core.security import get_password_hash

router = APIRouter()

@router.post("/signup", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def signup(user_data: UserCreate, db: Session = Depends(get_db)):
    # 1. 중복 검사 (이메일, 닉네임, 전화번호가 이미 있는지 확인)
    if db.query(User).filter(User.email == user_data.email).first():
        raise HTTPException(status_code=400, detail="이미 가입된 이메일입니다.")
    
    if db.query(User).filter(User.nickname == user_data.nickname).first():
        raise HTTPException(status_code=400, detail="이미 사용 중인 닉네임입니다.")
        
    if db.query(User).filter(User.phone == user_data.phone).first():
        raise HTTPException(status_code=400, detail="이미 가입된 전화번호입니다.")

    # 2. 비밀번호 요리하기 (암호화)
    hashed_pw = get_password_hash(user_data.password)

    # 3. DB에 넣을 형태(Model)로 조립하기
    # 주의: user_data.password(원문)가 아니라 방금 만든 hashed_pw를 넣습니다!
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_pw,
        nickname=user_data.nickname,
        phone=user_data.phone
    )

    # 4. DB에 진짜로 밀어넣기
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user