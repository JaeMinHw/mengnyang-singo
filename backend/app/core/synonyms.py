import json
import re
from functools import lru_cache
from pathlib import Path


SYNONYM_GROUPS_PATH = Path(__file__).resolve().parents[2] / "shared" / "synonym-groups.json"


@lru_cache(maxsize=1)
def load_synonym_groups() -> list[list[str]]:
    if not SYNONYM_GROUPS_PATH.exists():
        raise FileNotFoundError(
            f"synonym-groups.json 파일을 찾을 수 없습니다: {SYNONYM_GROUPS_PATH}"
        )

    with SYNONYM_GROUPS_PATH.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("synonym-groups.json 형식이 올바르지 않습니다.")

    return data


@lru_cache(maxsize=1)
def get_synonym_map() -> dict[str, str]:
    """동의어 → 대표어 맵 (프론트 synonymMap과 동일)"""
    synonym_map: dict[str, str] = {}

    for group in load_synonym_groups():
        if not group:
            continue

        representative = group[0]
        for word in group:
            synonym_map[word.lower()] = representative

    return synonym_map


def normalize_search_text(text: str) -> str:
    """텍스트의 동의어를 대표어로 치환 (프론트 normalizeSearchText와 동일)"""
    normalized = text.lower()
    synonym_map = get_synonym_map()

    for synonym in sorted(synonym_map.keys(), key=len, reverse=True):
        representative = synonym_map[synonym]
        normalized = re.sub(re.escape(synonym), representative.lower(), normalized, flags=re.IGNORECASE)

    return normalized