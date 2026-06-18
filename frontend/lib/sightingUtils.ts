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
  PROTECTING: { label: "보호 중", color: "bg-blue-100 text-blue-700", bgColor: "bg-blue-500" },
  FOUND: { label: "찾음", color: "bg-green-100 text-green-700", bgColor: "bg-green-500" },
};

export const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear().toString().slice(2)}.${String(
    date.getMonth() + 1
  ).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
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
  // 색상
  ["검정", "검정색", "검은색", "까만", "블랙", "black", "검은"],
  ["흰색", "하얀", "하얀색", "화이트", "white"],
  ["갈색", "브라운", "brown"],
  ["회색", "그레이", "grey", "gray"],
  ["노란색", "노랑", "황색", "옐로우", "yellow"],
  ["주황색", "주황", "오렌지", "orange"],
  ["베이지", "베이지색", "크림색"],
  ["고등어", "고등어색"],

  // 무늬
  ["삼색", "삼색이", "세가지색"],
  ["얼룩", "점박이", "반점"],
  ["줄무늬", "호랑이무늬", "타이거"],
  ["턱시도", "턱시도무늬"],

  // 크기
  ["소형", "작은", "소형견"],
  ["중형", "중간", "중형견"],
  ["대형", "큰", "대형견"],

  // 기타 특징
  ["장모", "장털", "긴털"],
  ["단모", "단털", "짧은털"],
];

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