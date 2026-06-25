from sqlalchemy import Column, BigInteger, String, DateTime, ForeignKey, Integer
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.core.database import Base


class SightingImage(Base):
    __tablename__ = "sighting_image"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    sighting_id = Column(BigInteger, ForeignKey("sighting.id"), nullable=False)
    image_url = Column(String(500), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    sighting = relationship("Sighting", back_populates="images")