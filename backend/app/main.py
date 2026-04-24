from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import health, sighting
from app.core.config import settings

app = FastAPI(
    title="멍냥신고 API",
    description="길고양이/유기견 목격 신고 서비스",
    version=settings.APP_VERSION
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(sighting.router )


@app.get("/")
def root():
    return {
        "message": "🐕🐈 멍냥신고 API 서버",
        "version": settings.APP_VERSION
    }