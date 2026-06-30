from dataclasses import dataclass
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from sqlalchemy.orm import Session

from app.models.sighting import Sighting
from app.core.synonyms import load_synonym_groups, normalize_search_text
from app.models.similar_match_history import SimilarMatchHistory


SIMILAR_SIGHTING_MAX_DISTANCE_METERS = 3000
SIMILAR_SIGHTING_MAX_RESULTS = 3


@dataclass
class SimilarSightingMatch:
    sighting: Sighting
    distance_meters: float
    matched_features: list[str]


def get_similar_match_pair_ids(
    sighting_id_1: int,
    sighting_id_2: int,
) -> tuple[int, int]:
    """같은 글쌍을 방향 없이 비교하기 위해 ID 오름차순으로 정렬"""
    if sighting_id_1 < sighting_id_2:
        return sighting_id_1, sighting_id_2
    return sighting_id_2, sighting_id_1


def has_similar_match_history(
    db: Session,
    sighting_id_1: int,
    sighting_id_2: int,
    recipient_user_id: int,
) -> bool:
    pair_source_id, pair_target_id = get_similar_match_pair_ids(
        sighting_id_1,
        sighting_id_2,
    )

    return (
        db.query(SimilarMatchHistory.id)
        .filter(
            SimilarMatchHistory.source_sighting_id == pair_source_id,
            SimilarMatchHistory.target_sighting_id == pair_target_id,
            SimilarMatchHistory.recipient_user_id == recipient_user_id,
        )
        .first()
        is not None
    )


def record_similar_match_history(
    db: Session,
    sighting_id_1: int,
    sighting_id_2: int,
    recipient_user_id: int,
) -> None:
    pair_source_id, pair_target_id = get_similar_match_pair_ids(
        sighting_id_1,
        sighting_id_2,
    )

    db.add(
        SimilarMatchHistory(
            source_sighting_id=pair_source_id,
            target_sighting_id=pair_target_id,
            recipient_user_id=recipient_user_id,
        )
    )


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
    """텍스트에서 대표 특징 키워드 추출 (프론트 extractFeatureKeywords와 동일)"""
    if not text:
        return []

    normalized = normalize_search_text(text)
    matched: list[str] = []

    for group in load_synonym_groups():
        if not group:
            continue

        representative = group[0].lower()
        if representative in normalized:
            matched.append(group[0])

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

    if base_sighting.is_deleted or base_sighting.status == "FOUND":
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