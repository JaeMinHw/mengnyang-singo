from dataclasses import dataclass
from datetime import timedelta
from math import atan2, cos, radians, sin, sqrt
from typing import Optional

from sqlalchemy.orm import Session

from app.models.sighting import Sighting
from app.core.synonyms import load_synonym_groups, normalize_search_text
from app.models.similar_match_history import SimilarMatchHistory


SIMILAR_SIGHTING_MAX_DISTANCE_METERS = 3000
SIMILAR_SIGHTING_MAX_RESULTS = 3
CASE_PREVIEW_MAX_DISTANCE_METERS = 5000
CASE_PREVIEW_MAX_RESULTS = 10
CASE_PREVIEW_MAX_DAYS = 30
CASE_PREVIEW_MAX_SPEED_KMH = 15.0

CASE_PREVIEW_SHORT_WINDOW_MINUTES = 10
CASE_PREVIEW_SHORT_WINDOW_MAX_DISTANCE_METERS = 2000

CASE_PREVIEW_MEDIUM_WINDOW_MINUTES = 30
CASE_PREVIEW_MEDIUM_WINDOW_MAX_DISTANCE_METERS = 4000

@dataclass
class SimilarSightingMatch:
    sighting: Sighting
    distance_meters: float
    matched_features: list[str]

@dataclass
class CasePreviewMatch:
    sighting: Sighting
    distance_meters: float
    time_diff_minutes: float
    estimated_speed_kmh: Optional[float]
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



def get_time_diff_minutes(
    base_created_at,
    candidate_created_at,
) -> float:
    if not base_created_at or not candidate_created_at:
        return 0.0

    diff_seconds = abs((candidate_created_at - base_created_at).total_seconds())
    return diff_seconds / 60


def get_estimated_speed_kmh(
    distance_meters: float,
    time_diff_minutes: float,
) -> Optional[float]:
    if time_diff_minutes <= 0:
        return None

    distance_km = distance_meters / 1000
    time_hours = time_diff_minutes / 60
    if time_hours <= 0:
        return None

    return distance_km / time_hours


def is_plausible_movement(
    distance_meters: float,
    time_diff_minutes: float,
    max_speed_kmh: float = CASE_PREVIEW_MAX_SPEED_KMH,
) -> bool:
    # 짧은 시간 + 긴 거리 = 바로 제외
    if (
        time_diff_minutes <= CASE_PREVIEW_SHORT_WINDOW_MINUTES
        and distance_meters >= CASE_PREVIEW_SHORT_WINDOW_MAX_DISTANCE_METERS
    ):
        return False

    if (
        time_diff_minutes <= CASE_PREVIEW_MEDIUM_WINDOW_MINUTES
        and distance_meters >= CASE_PREVIEW_MEDIUM_WINDOW_MAX_DISTANCE_METERS
    ):
        return False

    estimated_speed_kmh = get_estimated_speed_kmh(distance_meters, time_diff_minutes)
    if estimated_speed_kmh is not None and estimated_speed_kmh > max_speed_kmh:
        return False

    return True



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



def find_case_preview_sightings(
    db: Session,
    base_sighting: Sighting,
    max_distance_meters: int = CASE_PREVIEW_MAX_DISTANCE_METERS,
    max_results: int = CASE_PREVIEW_MAX_RESULTS,
    max_days: int = CASE_PREVIEW_MAX_DAYS,
) -> list[CasePreviewMatch]:
    if base_sighting.is_deleted:
        return []

    query = db.query(Sighting).filter(
        Sighting.id != base_sighting.id,
        Sighting.is_deleted == False,
        Sighting.animal_type == base_sighting.animal_type,
    )

    if base_sighting.created_at:
        min_created_at = base_sighting.created_at - timedelta(days=max_days)
        max_created_at = base_sighting.created_at + timedelta(days=max_days)
        query = query.filter(
            Sighting.created_at >= min_created_at,
            Sighting.created_at <= max_created_at,
        )

    candidates = query.all()

    base_features = set(extract_feature_keywords(base_sighting.description))
    scored: list[CasePreviewMatch] = []

    for candidate in candidates:
        distance_meters = get_distance_in_meters(
            base_sighting.latitude,
            base_sighting.longitude,
            candidate.latitude,
            candidate.longitude,
        )

        if distance_meters > max_distance_meters:
            continue

        time_diff_minutes = get_time_diff_minutes(
            base_sighting.created_at,
            candidate.created_at,
        )

        if not is_plausible_movement(distance_meters, time_diff_minutes):
            continue

        candidate_features = set(extract_feature_keywords(candidate.description))
        matched_features = sorted(base_features.intersection(candidate_features))

        # 양쪽 다 특징이 있는데 공통점이 하나도 없으면 제외
        if base_features and candidate_features and not matched_features:
            continue

        estimated_speed_kmh = get_estimated_speed_kmh(
            distance_meters,
            time_diff_minutes,
        )

        scored.append(
            CasePreviewMatch(
                sighting=candidate,
                distance_meters=distance_meters,
                time_diff_minutes=time_diff_minutes,
                estimated_speed_kmh=estimated_speed_kmh,
                matched_features=matched_features,
            )
        )

    # 1) 반대 post_type 우선
    # 2) 공통 특징 많은 순
    # 3) 시간 차이 적은 순
    # 4) 가까운 순
    scored.sort(
        key=lambda item: (
            item.sighting.post_type == base_sighting.post_type,
            -len(item.matched_features),
            item.time_diff_minutes,
            item.distance_meters,
        )
    )

    selected = scored[:max_results]

    # 프론트에서 이동 흐름 그리기 쉽도록 시간순 정렬
    selected.sort(
        key=lambda item: (
            item.sighting.created_at.timestamp()
            if item.sighting.created_at
            else 0
        )
    )

    return selected