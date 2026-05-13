from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserResponse
from app.core.security import get_password_hash
# 1. 스키마 import 추가
from app.schemas.user import UserCreate, UserResponse, UserLogin, Token
# 2. 보안 함수 import 추가
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.dependencies import get_current_user

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



# 3. 로그인 API 추가
@router.post("/login", response_model=Token)
def login(user_data: UserLogin, db: Session = Depends(get_db)):
    # 1) 이메일로 사용자 조회
    user = db.query(User).filter(User.email == user_data.email).first()

    # 2) 사용자가 없거나 비밀번호가 틀리면 401 Unauthorized 에러
    if not user or not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="이메일 또는 비밀번호가 올바르지 않습니다.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # 3) JWT 토큰 발급
    # 'sub'는 subject의 약자로, JWT 표준에서 '누구의 토큰인지'를 나타내는 클레임(claim)입니다.
    access_token = create_access_token(data={"sub": user.email})

    # 4) 토큰 반환
    return Token(access_token=access_token, token_type="bearer")


@router.get("/me", response_model=UserResponse)
def read_me(current_user: User = Depends(get_current_user)):
    """
    [보호된 API]
    현재 로그인한 사용자의 정보를 반환합니다.
    Authorization: Bearer <access_token> 헤더가 필요합니다.
    """
    return current_user