from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User


# Authorization: Bearer <token> 헤더를 읽기 위한 도구
# auto_error=False로 두면, 우리가 직접 401 응답을 제어할 수 있습니다.
bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """
    [보호된 API용 의존성]
    요청 헤더의 Bearer 토큰을 읽고,
    JWT를 검증한 뒤,
    현재 로그인한 User 객체를 반환합니다.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="유효하지 않은 인증 정보입니다.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # 1) 토큰 자체가 없는 경우
    if credentials is None:
        raise credentials_exception

    token = credentials.credentials

    # 2) JWT 서명 검증 + payload 해석
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )
        email = payload.get("sub")
        if email is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # 3) 토큰 속 이메일(sub)로 사용자 조회
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    return user