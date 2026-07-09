from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ChatRoomOpenRequest(BaseModel):
    sighting_id: int
    target_user_id: int


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    room_id: int
    sender_user_id: int
    sender_nickname: Optional[str] = None
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatRoomResponse(BaseModel):
    id: int
    sighting_id: int
    sighting_description: Optional[str] = None
    sighting_animal_type: Optional[str] = None
    sighting_address: Optional[str] = None
    sighting_post_type: Optional[str] = None
    sighting_is_deleted: bool = False
    owner_user_id: int
    owner_nickname: Optional[str] = None
    participant_user_id: int
    participant_nickname: Optional[str] = None
    last_message_at: Optional[datetime] = None
    last_message_content: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True