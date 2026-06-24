from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    sighting_id: Optional[int]
    comment_id: Optional[int]
    actor_id: Optional[int]
    actor_nickname: Optional[str] = None
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True