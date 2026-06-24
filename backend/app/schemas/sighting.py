from pydantic import BaseModel
from datetime import datetime
from typing import Optional, Literal


class SightingCreate(BaseModel):
    animal_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None
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
    latitude: float
    longitude: float
    address: Optional[str]
    status: str
    post_type: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    version: str


class SightingStatusUpdate(BaseModel):
    status: Literal["SPOTTED", "LOST", "PROTECTING", "FOUND"]


class SightingUpdate(BaseModel):
    animal_type: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    address: Optional[str] = None