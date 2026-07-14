from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Literal, List


class SightingCreate(BaseModel):
    animal_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    latitude: float
    longitude: float
    address: Optional[str] = None
    post_type: Literal["SIGHTING", "LOST"] = "SIGHTING"


class SightingResponse(BaseModel):
    id: int
    user_id: int
    user_nickname: Optional[str] = None
    animal_type: str
    description: Optional[str]
    image_url: Optional[str]
    image_urls: List[str] = Field(default_factory=list)
    latitude: float
    longitude: float
    address: Optional[str]
    status: str
    post_type: str
    resolved_at: Optional[datetime] = None
    reopen_reason: Optional[str] = None
    reopen_detail: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    version: str


class SightingStatusUpdate(BaseModel):
    status: Literal["SPOTTED", "LOST", "PROTECTING", "FOUND"]
    reopen_reason: Optional[
        Literal["WRONG_ANIMAL", "NOT_FOUND_YET", "MISTAKE", "OTHER"]
    ] = None
    reopen_detail: Optional[str] = None


class SightingUpdate(BaseModel):
    animal_type: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    image_urls: Optional[List[str]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None


class CasePreviewItemResponse(BaseModel):
    sighting: SightingResponse
    is_base: bool = False
    distance_meters: float
    time_diff_minutes: float
    estimated_speed_kmh: Optional[float] = None
    matched_features: List[str] = Field(default_factory=list)


class CasePreviewResponse(BaseModel):
    base_sighting_id: int
    items: List[CasePreviewItemResponse] = Field(default_factory=list)