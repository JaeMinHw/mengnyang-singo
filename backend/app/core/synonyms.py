import json
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