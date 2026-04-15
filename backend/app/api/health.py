from fastapi import APIRouter
from app.schemas.sighting import HealthResponse
from app.core.config import settings

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
def health_check():
    return {
        "status": "UP",
        "version": settings.APP_VERSION
    }