from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Comment(Base):
    __tablename__ = "comment"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=False)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    content = Column(Text, nullable=True)
    image_url = Column(String(500), nullable=True)
    is_deleted = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    user = relationship("User", lazy="joined")
    sighting = relationship("Sighting", lazy="joined")