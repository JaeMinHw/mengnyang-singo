from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CommentCreate(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None


class CommentUpdate(BaseModel):
    content: Optional[str] = None
    image_url: Optional[str] = None


class CommentResponse(BaseModel):
    id: int
    sighting_id: int
    user_id: int
    user_nickname: Optional[str] = None
    content: Optional[str]
    image_url: Optional[str]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True