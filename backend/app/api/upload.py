import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, status
from app.core.dependencies import get_current_user
from app.models.user import User

router = APIRouter()

UPLOAD_DIR = "/app/uploads"


@router.post("/upload/image")
def upload_image(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
):
    """
    [보호된 API]
    이미지 파일을 업로드하고 접근 가능한 URL을 반환합니다.
    로그인한 사용자만 사용 가능합니다.
    """
    # 이미지 파일인지 확인
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미지 파일만 업로드할 수 있습니다.",
        )

    # 파일 크기 제한 (10MB)
    MAX_SIZE = 10 * 1024 * 1024
    contents = file.file.read()
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="파일 크기는 10MB 이하만 가능합니다.",
        )

    # 저장 폴더 생성
    os.makedirs(UPLOAD_DIR, exist_ok=True)

    # 고유 파일명 생성
    ext = os.path.splitext(file.filename or "image.jpg")[1]
    filename = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    # 파일 저장
    with open(filepath, "wb") as f:
        f.write(contents)

    # 접근 가능한 URL 반환
    image_url = f"/api/uploads/{filename}"


    return {"image_url": image_url}