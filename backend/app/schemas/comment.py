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


class MyCommentResponse(CommentResponse):
    sighting_animal_type: Optional[str] = None
    sighting_address: Optional[str] = None
    sighting_status: Optional[str] = None
    sighting_post_type: Optional[str] = None
    sighting_image_url: Optional[str] = None
    sighting_description: Optional[str] = None


class MyCommentListResponse(BaseModel):
    items: list[MyCommentResponse]
    total: int