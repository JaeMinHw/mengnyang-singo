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