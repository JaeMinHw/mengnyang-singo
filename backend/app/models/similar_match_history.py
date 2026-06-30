from sqlalchemy import Column, BigInteger, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.core.database import Base


class SimilarMatchHistory(Base):
    __tablename__ = "similar_match_history"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    source_sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=False)
    target_sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=False)
    recipient_user_id = Column(BigInteger, ForeignKey("user.id"), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    source_sighting = relationship("Sighting", foreign_keys=[source_sighting_id])
    target_sighting = relationship("Sighting", foreign_keys=[target_sighting_id])
    recipient = relationship("User", foreign_keys=[recipient_user_id])

    __table_args__ = (
        UniqueConstraint(
            "source_sighting_id",
            "target_sighting_id",
            "recipient_user_id",
            name="uq_similar_match_history",
        ),
    )