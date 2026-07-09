from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class ChatRoom(Base):
    __tablename__ = "chat_room"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=False)
    owner_user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    participant_user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    last_message_at = Column(DateTime, nullable=True)

    sighting = relationship("Sighting", foreign_keys=[sighting_id], lazy="joined")
    owner = relationship("User", foreign_keys=[owner_user_id], lazy="joined")
    participant = relationship("User", foreign_keys=[participant_user_id], lazy="joined")
    messages = relationship(
        "ChatMessage",
        back_populates="room",
        order_by="ChatMessage.id",
        lazy="dynamic",
    )

    __table_args__ = (
        UniqueConstraint(
            "sighting_id",
            "owner_user_id",
            "participant_user_id",
            name="uq_chat_room",
        ),
    )