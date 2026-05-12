from pydantic import BaseModel, EmailStr
from datetime import datetime

# 1. 클라이언트가 회원가입할 때 보내는 데이터
class UserCreate(BaseModel):
    email: EmailStr
    password: str
    nickname: str
    phone: str

# 2. 서버가 클라이언트에게 응답으로 돌려줄 데이터
class UserResponse(BaseModel):
    id: int
    email: EmailStr
    nickname: str
    phone: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # ORM 모델을 딕셔너리로 자동 변환해주는 설정


# 3. 클라이언트가 로그인할 때 보내는 데이터
class UserLogin(BaseModel):
    email: EmailStr
    password: str


# 4. 로그인 성공 시 서버가 돌려줄 JWT 응답 데이터
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"