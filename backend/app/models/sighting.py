from sqlalchemy import Column, BigInteger, String, Text, Float, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Sighting(Base):
    __tablename__ = "sighting"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    animal_type = Column(String(20), nullable=False)
    description = Column(Text)
    image_url = Column(String(500))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(200))
    status = Column(String(20), default="SPOTTED")
    post_type = Column(String(20), default="SIGHTING", nullable=False)
    is_deleted = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    reopen_reason = Column(String(50), nullable=True)
    reopen_detail = Column(Text, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # User와의 관계
    user = relationship("User", lazy="joined")