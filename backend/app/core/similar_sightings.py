from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from sqlalchemy.orm import Session

from app.models.sighting import Sighting
from app.core.synonyms import load_synonym_groups


SIMILAR_SIGHTING_MAX_DISTANCE_METERS = 3000
SIMILAR_SIGHTING_MAX_RESULTS = 3


@dataclass
class SimilarSightingMatch:
    sighting: Sighting
    distance_meters: float
    matched_features: list[str]


def get_distance_in_meters(
    lat1: float,
    lng1: float,
    lat2: float,
    lng2: float,
) -> float:
    r = 6371000
    d_lat = radians(lat2 - lat1)
    d_lng = radians(lng2 - lng1)

    a = (
        sin(d_lat / 2) * sin(d_lat / 2)
        + cos(radians(lat1))
        * cos(radians(lat2))
        * sin(d_lng / 2)
        * sin(d_lng / 2)
    )
    c = 2 * atan2(sqrt(a), sqrt(1 - a))
    return r * c


def get_representative_keywords() -> list[str]:
    """shared synonym-groups.json에서 각 그룹의 대표어(첫 번째 단어)만 추출"""
    groups = load_synonym_groups()
    return [group[0] for group in groups if group]


def normalize_text(text: str) -> str:
    """텍스트를 소문자로 정규화"""
    return text.lower()


def extract_feature_keywords(text: Optional[str]) -> list[str]:
    """텍스트에서 대표 특징 키워드 추출"""
    if not text:
        return []

    normalized = normalize_text(text)
    representative_keywords = get_representative_keywords()
    matched: list[str] = []

    for keyword in representative_keywords:
        if keyword in normalized:
            matched.append(keyword)

    return matched


def find_similar_sightings(
    db: Session,
    base_sighting: Sighting,
    exclude_user_id: Optional[int] = None,
    max_distance_meters: int = SIMILAR_SIGHTING_MAX_DISTANCE_METERS,
    max_results: int = SIMILAR_SIGHTING_MAX_RESULTS,
) -> list[SimilarSightingMatch]:
    if base_sighting.post_type not in {"SIGHTING", "LOST"}:
        return []

    opposite_post_type = "LOST" if base_sighting.post_type == "SIGHTING" else "SIGHTING"

    query = db.query(Sighting).filter(
        Sighting.id != base_sighting.id,
        Sighting.is_deleted == False,
        Sighting.status != "FOUND",
        Sighting.post_type == opposite_post_type,
        Sighting.animal_type == base_sighting.animal_type,
    )

    if exclude_user_id is not None:
        query = query.filter(Sighting.user_id != exclude_user_id)

    candidates = query.all()

    base_features = set(extract_feature_keywords(base_sighting.description))
    scored: list[SimilarSightingMatch] = []

    for candidate in candidates:
        distance_meters = get_distance_in_meters(
            base_sighting.latitude,
            base_sighting.longitude,
            candidate.latitude,
            candidate.longitude,
        )

        if distance_meters > max_distance_meters:
            continue

        candidate_features = extract_feature_keywords(candidate.description)
        matched_features = [
            feature for feature in candidate_features if feature in base_features
        ]

        scored.append(
            SimilarSightingMatch(
                sighting=candidate,
                distance_meters=distance_meters,
                matched_features=matched_features,
            )
        )

    scored.sort(
        key=lambda item: (
            -len(item.matched_features),
            item.distance_meters,
            -(item.sighting.created_at.timestamp() if item.sighting.created_at else 0),
        )
    )

    return scored[:max_results]