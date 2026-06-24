from sqlalchemy import Column, BigInteger, String, Text, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class Notification(Base):
    __tablename__ = "notification"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    type = Column(String(30), nullable=False)
    sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=True)
    comment_id = Column(BigInteger, ForeignKey("comment.id"), nullable=True)
    actor_id = Column(BigInteger, ForeignKey("user.id"), nullable=True)
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("User", foreign_keys=[user_id], lazy="joined")
    actor = relationship("User", foreign_keys=[actor_id], lazy="joined")