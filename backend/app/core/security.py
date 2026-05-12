from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta
from app.core.config import settings

# bcrypt 알고리즘을 사용하는 암호화 도구(컨텍스트) 생성
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    """
    [회원가입 용도]
    비밀번호 원문을 받아서 알아볼 수 없는 해시 문자열로 반환합니다.
    """
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    [로그인 용도]
    사용자가 방금 입력한 비밀번호(plain_password)와 
    DB에 저장되어 있던 해시값(hashed_password)이 같은지 비교해서 True/False를 반환합니다.
    """
    return pwd_context.verify(plain_password, hashed_password)


def create_access_token(data: dict) -> str:
    """
    [JWT 토큰 발급 용도]
    전달받은 data(예: 이메일)를 payload에 담아
    서명된 JWT access token 문자열을 반환합니다.
    """
    to_encode = data.copy()

    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt