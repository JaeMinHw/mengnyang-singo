from pydantic import BaseModel
from datetime import datetime


class KeywordCreate(BaseModel):
    keyword: str


class KeywordResponse(BaseModel):
    id: int
    user_id: int
    keyword: str
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True