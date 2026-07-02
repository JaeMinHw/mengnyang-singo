import type { Sighting } from "@/types/sighting";
import synonymGroupsData from "../shared/synonym-groups.json";


export const animalConfig: Record<
  string,
  { emoji: string; color: string; label: string }
> = {
  CAT: { emoji: "🐱", color: "bg-orange-500", label: "고양이" },
  DOG: { emoji: "🐶", color: "bg-blue-500", label: "강아지" },
  OTHER: { emoji: "🐾", color: "bg-purple-500", label: "기타" },
};

export const statusConfig: Record<
  string,
  { label: string; color: string; bgColor: string }
> = {
  SPOTTED: { label: "목격", color: "bg-yellow-100 text-yellow-700", bgColor: "bg-yellow-500" },
  LOST: { label: "실종", color: "bg-red-100 text-red-700", bgColor: "bg-red-500" },
  PROTECTING: { label: "보호 중", color: "bg-blue-100 text-blue-700", bgColor: "bg-blue-500" },
  FOUND: { label: "찾음", color: "bg-green-100 text-green-700", bgColor: "bg-green-500" },
};


export const postTypeConfig: Record<
  string,
  { label: string; emoji: string; color: string; bgColor: string }
> = {
  SIGHTING: {
    label: "목격",
    emoji: "👀",
    color: "bg-amber-100 text-amber-700",
    bgColor: "bg-amber-500",
  },
  LOST: {
    label: "실종",
    emoji: "🔍",
    color: "bg-rose-100 text-rose-700",
    bgColor: "bg-rose-500",
  },
};

const hasTimezoneInfo = (dateString: string) => {
  return /(?:Z|[+-]\d{2}:\d{2})$/i.test(dateString);
};

const parseApiDate = (dateString: string) => {
  const normalized = hasTimezoneInfo(dateString)
    ? dateString
    : `${dateString}Z`;

  return new Date(normalized);
};


export const formatDate = (dateString: string) => {
  return parseApiDate(dateString).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateShort = (dateString: string) => {
  const date = parseApiDate(dateString);

  const formatter = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  });

  const parts = formatter.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";

  return `${year}.${month}.${day}`;
};

export const isEdited = (createdAt: string, updatedAt: string): boolean => {
  const created = parseApiDate(createdAt);
  const updated = parseApiDate(updatedAt);

  // 1분 이상 차이나면 수정된 것으로 판단
  return Math.abs(updated.getTime() - created.getTime()) > 60_000;
};


export const getArchivedStatus = (
  resolvedAt: string | null
): { isArchived: boolean; daysLeft: number | null } => {
  if (!resolvedAt) return { isArchived: false, daysLeft: null };

  const resolved = parseApiDate(resolvedAt);
  const now = new Date();
  const diffMs = now.getTime() - resolved.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  return {
    isArchived: diffDays >= 30,
    daysLeft: Math.max(0, 30 - diffDays),
  };
};

export const parseAddress = (address: string | null) => {
  if (!address) return { main: null, detail: null };

  const parts = address.split("|||");
  return {
    main: parts[0] || null,
    detail: parts[1] || null,
  };
};


export const getKakaoMapLink = (
  latitude: number,
  longitude: number,
  name?: string
) => {
  const label = encodeURIComponent(name || "목적지");
  return `https://map.kakao.com/link/to/${label},${latitude},${longitude}`;
};




export const getKakaoMapSearchLink = (query: string) => {
  return `https://map.kakao.com/?q=${encodeURIComponent(query)}`;
};

export const openKakaoMapSearch = (query: string) => {
  if (typeof window === "undefined") return;

  const encodedQuery = encodeURIComponent(query);
  const webUrl = getKakaoMapSearchLink(query);
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // PC는 웹 검색 새 탭
  if (!isMobile) {
    window.open(webUrl, "_blank", "noopener,noreferrer");
    return;
  }

  // 모바일은 카카오맵 앱 검색 시도
  const appUrl = `kakaomap://search?q=${encodedQuery}`;
  let didHide = false;

  const handleVisibilityChange = () => {
    if (document.hidden) {
      didHide = true;
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);

  window.location.href = appUrl;

  // 앱이 안 열리면 웹 검색으로 fallback
  window.setTimeout(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);

    if (!didHide) {
      window.location.href = webUrl;
    }
  }, 800);
};

const synonymGroups = synonymGroupsData as string[][];



const representativeToGroup = new Map<string, string[]>();

synonymGroups.forEach((group) => {
  representativeToGroup.set(group[0].toLowerCase(), group);
});


// 동의어 → 대표어 맵 생성
const synonymMap = new Map<string, string>();
synonymGroups.forEach((group) => {
  const representative = group[0]; // 첫 번째가 대표어
  group.forEach((word) => {
    synonymMap.set(word.toLowerCase(), representative);
  });
});



const HANGUL_START = 0xac00;
const HANGUL_END = 0xd7a3;
const CHOSUNG = [
  "ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ",
  "ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
];
const JUNGSUNG = [
  "ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ",
  "ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ",
];
const JONGSUNG = [
  "","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ",
  "ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ",
];

export const decomposeHangul = (text: string): string => {
  return text
    .split("")
    .map((char) => {
      const code = char.charCodeAt(0);

      // 완성형 한글 음절
      if (code >= HANGUL_START && code <= HANGUL_END) {
        const offset = code - HANGUL_START;
        const cho = Math.floor(offset / 588);
        const jung = Math.floor((offset % 588) / 28);
        const jong = offset % 28;

        return CHOSUNG[cho] + JUNGSUNG[jung] + JONGSUNG[jong];
      }

      // 이미 자모이거나 다른 문자는 그대로
      return char;
    })
    .join("");
};


const buildSearchTarget = (text: string) => {
  const raw = text.toLowerCase();
  const normalized = normalizeSearchText(raw);

  return {
    raw,
    normalized,
    rawDecomposed: decomposeHangul(raw),
    normalizedDecomposed: decomposeHangul(normalized),
  };
};

const getQueryVariants = (word: string): string[] => {
  const raw = word.trim().toLowerCase();
  if (!raw) return [];

  const normalized = normalizeSearchText(raw);
  const rawDecomposed = decomposeHangul(raw);
  const normalizedDecomposed = decomposeHangul(normalized);

  const variants = new Set<string>([raw, normalized]);

  synonymGroups.forEach((group) => {
    const lowerGroup = group.map((term) => term.toLowerCase());

    const isMatchedGroup = lowerGroup.some((term) => {
      const normalizedTerm = normalizeSearchText(term);
      const termDecomposed = decomposeHangul(term);
      const normalizedTermDecomposed = decomposeHangul(normalizedTerm);

      return (
        term.includes(raw) ||
        normalizedTerm.includes(normalized) ||
        termDecomposed.includes(rawDecomposed) ||
        termDecomposed.includes(normalizedDecomposed) ||
        normalizedTermDecomposed.includes(rawDecomposed) ||
        normalizedTermDecomposed.includes(normalizedDecomposed)
      );
    });

    if (!isMatchedGroup) return;

    lowerGroup.forEach((term) => {
      variants.add(term);
      variants.add(normalizeSearchText(term));
    });
  });

  return Array.from(variants).filter(Boolean);
};

const targetMatchesVariant = (
  target: ReturnType<typeof buildSearchTarget>,
  variant: string
): boolean => {
  const normalizedVariant = normalizeSearchText(variant);
  const decomposedVariant = decomposeHangul(variant);
  const decomposedNormalizedVariant = decomposeHangul(normalizedVariant);

  return (
    target.raw.includes(variant) ||
    target.raw.includes(normalizedVariant) ||
    target.normalized.includes(variant) ||
    target.normalized.includes(normalizedVariant) ||
    target.rawDecomposed.includes(decomposedVariant) ||
    target.rawDecomposed.includes(decomposedNormalizedVariant) ||
    target.normalizedDecomposed.includes(decomposedVariant) ||
    target.normalizedDecomposed.includes(decomposedNormalizedVariant)
  );
};



export const normalizeSearchText = (text: string): string => {
  if (!text) return "";

  let normalized = text.toLowerCase();

  // 동의어를 대표어로 치환
  synonymMap.forEach((representative, synonym) => {
    // 단어 경계를 고려해서 치환 (부분 매칭 방지)
    const regex = new RegExp(synonym, "gi");
    normalized = normalized.replace(regex, representative);
  });

  return normalized;
};


export const matchesSearch = (
  sighting: { address: string | null; description: string | null },
  searchQuery: string
): boolean => {
  if (!searchQuery.trim()) return true;

  const queryWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const target = buildSearchTarget(
    [sighting.address || "", sighting.description || ""].join(" ")
  );

  // 모든 검색어가 매칭되어야 함 (AND)
  return queryWords.every((word) => {
    const variants = getQueryVariants(word);
    return variants.some((variant) => targetMatchesVariant(target, variant));
  });
};


const escapeRegExp = (value: string) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const getHighlightTerms = (searchQuery: string): string[] => {
  if (!searchQuery.trim()) return [];

  const rawWords = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);
  const terms = new Set<string>();

  rawWords.forEach((word) => {
    const normalizedWord = normalizeSearchText(word).trim().toLowerCase();
    const representative =
      synonymMap.get(word) ??
      synonymMap.get(normalizedWord) ??
      normalizedWord;

    const group = representativeToGroup.get(representative);

    if (group) {
      group.forEach((term) => terms.add(term));
    } else {
      terms.add(word);
      if (normalizedWord) {
        terms.add(normalizedWord);
      }
    }
  });

  return Array.from(terms).sort((a, b) => b.length - a.length);
};

export const getHighlightParts = (
  text: string,
  searchQuery: string
): { text: string; matched: boolean }[] => {
  if (!text) return [];

  const terms = getHighlightTerms(searchQuery);

  if (terms.length === 0) {
    return [{ text, matched: false }];
  }

  const regex = new RegExp(`(${terms.map(escapeRegExp).join("|")})`, "gi");
  const lowerTerms = new Set(terms.map((term) => term.toLowerCase()));

  return text
    .split(regex)
    .filter(Boolean)
    .map((part) => ({
      text: part,
      matched: lowerTerms.has(part.toLowerCase()),
    }));
};


export interface RelatedSightingResult {
  sighting: Sighting;
  distanceMeters: number;
  matchedFeatures: string[];
}

export const RELATED_SIGHTING_MAX_DISTANCE_METERS = 3000;
export const RELATED_SIGHTING_MAX_RESULTS = 10;

export const getDistanceInMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number => {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const extractFeatureKeywords = (text: string | null): string[] => {
  if (!text) return [];

  const normalized = normalizeSearchText(text);
  const matched = new Set<string>();

  representativeToGroup.forEach((_group, representative) => {
    if (normalized.includes(representative)) {
      matched.add(representative);
    }
  });

  return Array.from(matched);
};

export const formatDistance = (distanceMeters: number): string => {
  if (distanceMeters < 1000) {
    return `${Math.round(distanceMeters)}m`;
  }

  return `${(distanceMeters / 1000).toFixed(1)}km`;
};

export const getRelatedSightings = (
  baseSighting: Sighting,
  allSightings: Sighting[],
  options?: {
    maxDistanceMeters?: number;
    maxResults?: number;
  }
): RelatedSightingResult[] => {
  const maxDistanceMeters =
    options?.maxDistanceMeters ?? RELATED_SIGHTING_MAX_DISTANCE_METERS;
  const maxResults =
    options?.maxResults ?? RELATED_SIGHTING_MAX_RESULTS;

  const baseFeatures = extractFeatureKeywords(baseSighting.description);
  const baseFeatureSet = new Set(baseFeatures);

  const scored = allSightings
    .filter((candidate) => candidate.id !== baseSighting.id)
    .filter((candidate) => candidate.animal_type === baseSighting.animal_type)
    .filter((candidate) => candidate.status !== "FOUND")
    .map((candidate) => {
      const distanceMeters = getDistanceInMeters(
        baseSighting.latitude,
        baseSighting.longitude,
        candidate.latitude,
        candidate.longitude
      );

      const candidateFeatures = extractFeatureKeywords(candidate.description);
      const matchedFeatures = candidateFeatures.filter((feature) =>
        baseFeatureSet.has(feature)
      );

      // 교차 추천(다른 post_type)이면 가산점
      const isCrossType = candidate.post_type !== baseSighting.post_type;

      return {
        sighting: candidate,
        distanceMeters,
        matchedFeatures,
        isCrossType,
      };
    })
    .filter((item) => item.distanceMeters <= maxDistanceMeters);

  // 정렬: 교차 추천 우선 → 특징 많이 겹침 → 가까움 → 최신
  scored.sort((a, b) => {
    // 1. 교차 추천(실종↔목격)이 먼저
    if (a.isCrossType !== b.isCrossType) {
      return a.isCrossType ? -1 : 1;
    }

    // 2. 특징 키워드 많이 겹치는 순
    if (b.matchedFeatures.length !== a.matchedFeatures.length) {
      return b.matchedFeatures.length - a.matchedFeatures.length;
    }

    // 3. 가까운 순
    if (a.distanceMeters !== b.distanceMeters) {
      return a.distanceMeters - b.distanceMeters;
    }

    // 4. 최신 순
    return (
      new Date(b.sighting.created_at).getTime() -
      new Date(a.sighting.created_at).getTime()
    );
  });

  return scored.slice(0, maxResults).map(({ sighting, distanceMeters, matchedFeatures }) => ({
    sighting,
    distanceMeters,
    matchedFeatures,
  }));
};