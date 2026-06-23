import type { Sighting } from "@/types/sighting";


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


// =============================================
// 검색용 동의어 정규화
// =============================================

const synonymGroups: string[][] = [
  // 🎨 색상 (기본 색상 및 펫 특화 색상 명칭 추가)
  ["검정", "검정색", "검은색", "까만", "까만색", "까망", "깜장", "블랙", "black", "올블랙", "다크", "흑색"],
  ["흰색", "하얀", "하얀색", "화이트", "white", "백색", "올화이트", "백구"],
  ["갈색", "브라운", "brown", "밤색", "초코", "초코색", "초콜릿", "탄"],
  ["회색", "그레이", "grey", "gray", "쥐색", "실버", "은색", "블루"], // '블루'는 러시안블루, 프렌치불독 등에서 회색을 뜻함
  ["노란색", "노랑", "황색", "옐로우", "yellow", "누런", "누렁", "누렁이", "황구", "골드", "금색"],
  ["주황색", "주황", "오렌지", "orange", "레드", "붉은색", "적색", "진저"],
  ["베이지", "베이지색", "크림", "크림색", "아이보리", "연갈색", "폰"], // '폰(fawn)'은 옅은 황갈색을 뜻함

  // 🐾 무늬 (강아지/고양이 주요 패턴 및 애칭 추가)
  ["고등어", "고등어색", "고등어태비"],
  ["치즈", "치즈색", "치즈태비", "노란줄무늬", "올치즈"], // 고양이 특화
  ["삼색", "삼색이", "세가지색", "칼리코", "calico"],
  ["카오스", "토티쉘", "거북이등껍질"], // 삼색이와 비슷하지만 흰색이 없는 패턴
  ["얼룩", "점박이", "반점", "바둑이", "스팟", "spotted", "파티컬러", "파이발드"],
  ["줄무늬", "호랑이무늬", "타이거", "태비", "tabby", "브린들"], // '브린들'은 강아지의 호피무늬를 뜻함
  ["턱시도", "턱시도무늬", "젖소", "젖소무늬", "바이컬러", "투톤"],
  ["멀", "merle", "대리석무늬"], // 보더콜리, 오스트레일리안 셰퍼드 등에서 나타나는 대리석 무늬

  // 📏 크기 (초소형, 초대형 추가 및 영문 확장)
  ["초소형", "초소형견", "토이", "티컵"],
  ["소형", "소형견", "작은", "스몰", "small", "소형묘"],
  ["중형", "중간", "중형견", "미디엄", "medium", "중형묘"],
  ["대형", "큰", "대형견", "라지", "large", "대형묘"],
  ["초대형", "초대형견", "자이언트"],

  // ✂️ 털 길이 및 형태 (곱슬, 무모 등 추가)
  ["장모", "장털", "긴털", "장모종", "롱코트", "long"],
  ["중모", "중장모", "중간털"],
  ["단모", "단털", "짧은털", "단모종", "숏코트", "short"],
  ["곱슬", "곱슬털", "푸들털", "웨이비", "파마"],
  ["강모", "뻣뻣한털", "와이어", "거친털"],
  ["무모", "털없는", "헤어리스", "스핑크스"],

  // 🎂 연령대 (검색 및 필터링용)
  ["새끼", "아기", "퍼피", "자견", "강아지", "아깽이", "키튼", "자묘", "새끼고양이", "1살미만"],
  ["성체", "성견", "성묘", "어른", "성묘", "다큰"],
  ["노령", "노견", "노묘", "시니어", "할아버지", "할머니", "나이많은"],

  // 👂 신체 특징 (유기동물 식별에 매우 자주 쓰이는 키워드)
  ["단미", "꼬리없는", "짧은꼬리", "몽당꼬리", "밥테일", "코기꼬리"],
  ["접힌귀", "폴드", "처진귀", "덮인귀"],
  ["선귀", "쫑긋한귀", "선귀", "짝귀"],
  ["오드아이", "파란눈", "양쪽눈색다름", "홍채이색증"],

  // 복장 특징 (유기동물 신고 시 종종 언급되는 키워드)
  ["장화", "신발", "부츠", "양말"],
  ["흉터","상처", "자국", "수술"],
];


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

  const normalizedQuery = normalizeSearchText(searchQuery);
  const queryWords = normalizedQuery.split(/\s+/).filter(Boolean);

  const targetText = normalizeSearchText(
    [sighting.address || "", sighting.description || ""].join(" ")
  );

  // 모든 검색어가 포함되어야 매칭 (AND 조건)
  return queryWords.every((word) => targetText.includes(word));
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