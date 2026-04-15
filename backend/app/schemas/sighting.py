from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class SightingCreate(BaseModel):
    animal_type: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = None


class SightingResponse(BaseModel):
    id: int
    animal_type: str
    description: Optional[str]
    image_url: Optional[str]
    latitude: float
    longitude: float
    address: Optional[str]
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class HealthResponse(BaseModel):
    status: str
    version: str