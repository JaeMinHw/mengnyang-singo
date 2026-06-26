from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from sqlalchemy.orm import Session

from app.models.sighting import Sighting


SIMILAR_SIGHTING_MAX_DISTANCE_METERS = 3000
SIMILAR_SIGHTING_MAX_RESULTS = 3

FEATURE_KEYWORDS = [
    "검정", "흰색", "갈색", "회색", "노란색", "주황색", "베이지",
    "고등어", "치즈", "삼색", "카오스", "얼룩", "줄무늬", "턱시도", "멀",
    "초소형", "소형", "중형", "대형", "초대형",
    "장모", "중모", "단모", "곱슬", "강모", "무모",
    "새끼", "성체", "노령",
    "단미", "접힌귀", "선귀", "오드아이",
    "장화", "흉터",
]


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


def extract_feature_keywords(text: Optional[str]) -> list[str]:
    if not text:
        return []

    normalized = text.lower()
    matched: list[str] = []

    for keyword in FEATURE_KEYWORDS:
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
            -len(item.matched_features),           # 공통 특징 많은 순
            item.distance_meters,                  # 가까운 순
            -(item.sighting.created_at.timestamp() if item.sighting.created_at else 0),  # 최신 순
        )
    )

    return scored[:max_results]