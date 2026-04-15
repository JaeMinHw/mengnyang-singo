from sqlalchemy import Column, BigInteger, String, Text, Float, DateTime
from sqlalchemy.sql import func
from app.core.database import Base


class Sighting(Base):
    __tablename__ = "sighting"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    animal_type = Column(String(20), nullable=False)   # DOG, CAT, OTHER
    description = Column(Text)
    image_url = Column(String(500))
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    address = Column(String(200))
    status = Column(String(20), default="SPOTTED")     # SPOTTED, PROTECTING, SHELTERED, ADOPTED
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())