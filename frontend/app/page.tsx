"use client";

import { Map as KakaoMap, MapMarker, MarkerClusterer, CustomOverlayMap, useMap } from "react-kakao-maps-sdk";
import Script from "next/script";
import { useEffect, useState, useRef, useCallback } from "react";
import api from "@/lib/api";
import Header from "@/components/Header";

interface Sighting {
  id: number;
  animal_type: string;
  description: string | null;
  image_url: string | null;
  latitude: number;
  longitude: number;
  address: string | null;
  status: string;
  created_at: string;
}

interface ClusterInfo {
  center: { lat: number; lng: number };
  markers: Sighting[];
}

interface CurrentUser {
  id: number;
  email: string;
  nickname: string;
  phone: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const animalConfig: Record<string, { emoji: string; color: string; label: string }> = {
  CAT: { emoji: "🐱", color: "bg-orange-500", label: "고양이" },
  DOG: { emoji: "🐶", color: "bg-blue-500", label: "강아지" },
  OTHER: { emoji: "🐾", color: "bg-purple-500", label: "기타" },
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatDateShort = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear().toString().slice(2)}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
};
// 주소에서 기본 주소와 상세 위치를 분리
const parseAddress = (address: string | null) => {
  if (!address) return { main: null, detail: null };

  const parts = address.split("|||");
  return {
    main: parts[0] || null,
    detail: parts[1] || null,
  };
};


// =============================================
// 지도 내부 로직
// =============================================
function MapWithLogic({
  sightings,
  focusedSighting,
  onMarkerSelect,
  onBoundsChange,
  onImageClick,
}: {
  sightings: Sighting[];
  focusedSighting: Sighting | null;
  onMarkerSelect: (sighting: Sighting) => void;
  onBoundsChange: (visibleSightings: Sighting[]) => void;
  onImageClick: (imageUrl: string) => void;
}) {
  const map = useMap();
  const [selectedMarker, setSelectedMarker] = useState<Sighting | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ClusterInfo | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);
  const markerRef = useRef(new Map<kakao.maps.Marker, number>());
  const focusMarkerWithOffset = (position: kakao.maps.LatLng, hasImage: boolean = false) => {
    if (!map) return;

    map.setLevel(3);
    map.setCenter(position);

    let panOffsetY: number;

    if (window.innerWidth < 1024) {
      // 모바일: 이미지 있으면 더 내리고, 없으면 덜 내림
      panOffsetY = hasImage ? -140 : -80;
    } else {
      // PC: 이미지 있으면 더 내리고, 없으면 덜 내림
      panOffsetY = hasImage ? -100 : -60;
    }

    setTimeout(() => {
      map.panBy(0, panOffsetY);
    }, 0);
  };
  // 현재 지도 범위 안의 신고만 계산해서 부모에게 전달
  const updateVisibleSightings = useCallback(() => {
    if (!map) return;

    const bounds = map.getBounds();
    const sw = bounds.getSouthWest();
    const ne = bounds.getNorthEast();

    const visible = sightings.filter(
      (s) =>
        s.latitude >= sw.getLat() &&
        s.latitude <= ne.getLat() &&
        s.longitude >= sw.getLng() &&
        s.longitude <= ne.getLng()
    );

    onBoundsChange(visible);
  }, [map, sightings, onBoundsChange]);

  // 지도 이동/확대 시 visible 업데이트
  useEffect(() => {
    if (!map) return;

    // 최초 1회 실행
    updateVisibleSightings();

    // idle: 지도 이동/확대/축소가 끝났을 때 발생하는 이벤트
    kakao.maps.event.addListener(map, "idle", updateVisibleSightings);

    return () => {
      kakao.maps.event.removeListener(map, "idle", updateVisibleSightings);
    };
  }, [map, updateVisibleSightings]);

  // sightings가 바뀌면(필터 변경 등) visible도 다시 계산
  useEffect(() => {
    updateVisibleSightings();
  }, [sightings, updateVisibleSightings]);

  const handleMapClick = () => {
    setSelectedMarker(null);
    setSelectedCluster(null);
    setLastSelectedId(null);

  };

  useEffect(() => {
    if (!map) return;
    kakao.maps.event.addListener(map, "click", handleMapClick);
    return () => {
      kakao.maps.event.removeListener(map, "click", handleMapClick);
    };
  }, [map]);

  useEffect(() => {
    if (!map) return;

    const handleZoomChanged = () => {
      setSelectedMarker(null);
      setSelectedCluster(null);
    };

    kakao.maps.event.addListener(map, "zoom_changed", handleZoomChanged);

    return () => {
      kakao.maps.event.removeListener(map, "zoom_changed", handleZoomChanged);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !focusedSighting) return;

    const targetPosition = new kakao.maps.LatLng(
      Number(focusedSighting.latitude),
      Number(focusedSighting.longitude)
    );

    focusMarkerWithOffset(targetPosition, !!focusedSighting.image_url);
    setSelectedCluster(null);
    setSelectedMarker(focusedSighting);
    setLastSelectedId(focusedSighting.id);

  }, [map, focusedSighting]);

  const handleClusterClick = (_target: kakao.maps.MarkerClusterer, cluster: kakao.maps.Cluster) => {
    const clusterMarkers = cluster.getMarkers();
    const clusterSightings = clusterMarkers
      .map((marker) => markerRef.current.get(marker as kakao.maps.Marker))
      .filter((id): id is number => id !== undefined)
      .map((id) => sightings.find((s) => s.id === id))
      .filter((s): s is Sighting => s !== undefined);

    if (clusterSightings.length > 0) {
      setSelectedCluster({
        center: { lat: cluster.getCenter().getLat(), lng: cluster.getCenter().getLng() },
        markers: clusterSightings,
      });
      setSelectedMarker(null);
    }
  };

  const handleListItemClick = (sighting: Sighting) => {
    if (!map) return;

    const targetPosition = new kakao.maps.LatLng(
      Number(sighting.latitude),
      Number(sighting.longitude)
    );

    focusMarkerWithOffset(targetPosition, !!sighting.image_url);
    setSelectedCluster(null);
    setSelectedMarker(sighting);
    setLastSelectedId(sighting.id);
  };

  return (
    <>
      <MarkerClusterer averageCenter={true} minLevel={6} gridSize={60} disableClickZoom={true} onClusterclick={handleClusterClick}>
        {sightings.map((sighting) => (
          <MapMarker
            key={sighting.id}
            position={{ lat: sighting.latitude, lng: sighting.longitude }}
            onCreate={(marker) => markerRef.current.set(marker, sighting.id)}
            onClick={(marker) => {
              focusMarkerWithOffset(marker.getPosition(), !!sighting.image_url);
              setSelectedMarker(sighting);
              setSelectedCluster(null);
              setLastSelectedId(sighting.id);
              onMarkerSelect(sighting);
            }}
            image={{
              src: sighting.animal_type === "DOG" ? "/dog-marker.png" : "/cat-marker.png",
              size: { width: 36, height: 36 },
            }}
          />
        ))}
      </MarkerClusterer>
      {/* 마지막으로 선택한 마커 하이라이트 링 */}
        {lastSelectedId && !selectedMarker && (() => {
          const target = sightings.find((s) => s.id === lastSelectedId);
          if (!target) return null;

          return (
            <CustomOverlayMap
              position={{ lat: target.latitude, lng: target.longitude }}
              xAnchor={0.5}
              yAnchor={0.89}
            >
              <div className="w-11 h-11 rounded-full border-[3px] border-orange-500 bg-orange-500/20 pointer-events-none" />

            </CustomOverlayMap>
          );
        })()}
      {selectedMarker && (
        <CustomOverlayMap
            position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }}
            yAnchor={selectedMarker.image_url ? 1.16 : 1.3}
            clickable={true}
          >
          <div className="relative flex flex-col items-center drop-shadow-xl">
            <div className="p-4 bg-white rounded-2xl border border-gray-100 w-[calc(100vw-2rem)] max-w-xs lg:min-w-[200px] z-10">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${selectedMarker.animal_type === "DOG" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                  {animalConfig[selectedMarker.animal_type]?.emoji} {animalConfig[selectedMarker.animal_type]?.label || "동물"}
                </span>
                <button onClick={() => setSelectedMarker(null)} className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors ml-4">
                  <span className="text-xs font-bold">✕</span>
                </button>
              </div>
              {selectedMarker.address && (() => {
                const { main, detail } = parseAddress(selectedMarker.address);
                return (
                  <div className="text-xs text-gray-500 mt-1">
                    {main && <p>📍 {main}</p>}
                    {detail && <p className="text-gray-400">└ {detail}</p>}
                  </div>
                );
              })()}

              {selectedMarker.image_url && (
                <img
                  src={selectedMarker.image_url}
                  alt="신고 이미지"
                  className="w-full h-32 object-cover rounded-xl border border-gray-200 mt-2 cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onImageClick(selectedMarker.image_url!)}
                />
              )}

              <p className="text-sm text-gray-700 mt-1 leading-relaxed line-clamp-3">
                {selectedMarker.description || "등록된 특징 설명이 없습니다."}
              </p>
              <div className="text-[11px] text-gray-400 mt-3 text-right">{formatDateShort(selectedMarker.created_at)}</div>
            </div>
            <div className="w-4 h-4 bg-white transform rotate-45 -translate-y-1 border-b border-r border-gray-100 -z-0"></div>

          </div>
        </CustomOverlayMap>
      )}

      {selectedCluster && (
        <CustomOverlayMap position={selectedCluster.center} yAnchor={1.15} clickable={true}>
          <div className="relative flex flex-col items-center drop-shadow-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 w-[calc(100vw-2rem)] max-w-80 max-h-[45dvh] lg:w-80 lg:max-h-[340px] flex flex-col overflow-hidden z-10">
              <div className="bg-gray-50/90 backdrop-blur-sm p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-20">
                <div className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  📋 이 주변 발견 신고
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">{selectedCluster.markers.length}</span>
                </div>
                <button onClick={() => setSelectedCluster(null)} className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors">
                  <span className="text-sm font-bold">✕</span>
                </button>
              </div>
              <ul className="overflow-y-auto divide-y divide-gray-50" onWheel={(e) => e.stopPropagation()}>
                {selectedCluster.markers.map((marker) => (
                  <li
                    key={marker.id}
                    className="cursor-pointer hover:bg-slate-50 active:bg-slate-100 p-4 transition-all duration-200 group"
                    onClick={() => handleListItemClick(marker)}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div
                        className={`text-sm font-semibold flex items-center gap-1.5 ${
                          marker.animal_type === "DOG" ? "text-blue-700" : "text-orange-700"
                        }`}
                      >
                        {animalConfig[marker.animal_type]?.emoji}{" "}
                        {animalConfig[marker.animal_type]?.label || "동물"}
                      </div>
                      <span className="text-[11px] text-gray-400 group-hover:text-gray-500">
                        {formatDateShort(marker.created_at)}
                      </span>
                    </div>

                    {marker.address && (() => {
                      const { main, detail } = parseAddress(marker.address);
                      return (
                        <div className="text-xs text-gray-500 mb-2">
                          {main && <p>📍 {main}</p>}
                          {detail && <p className="text-gray-400">└ {detail}</p>}
                        </div>
                      );
                    })()}

                    {marker.image_url && (
                      <img
                        src={marker.image_url}
                        alt="신고 썸네일"
                        className="w-full h-20 object-cover rounded-lg border border-gray-200 mb-2 cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          onImageClick(marker.image_url!);
                        }}
                      />
                    )}

                    <div className="text-sm text-gray-600 leading-snug line-clamp-2">
                      {marker.description || "등록된 특징이 없습니다."}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="w-5 h-5 bg-white transform rotate-45 -translate-y-2.5 border-b border-r border-gray-100 -z-0"></div>
          </div>
        </CustomOverlayMap>
      )}
    </>
  );
}


function SightingList({
  sightings,
  selectedId,
  onSelect,
}: {
  sightings: Sighting[];
  selectedId: number | null;
  onSelect: (sighting: Sighting) => void;
}) {
  return (
    <ul className="divide-y divide-gray-100">
      {sightings.map((sighting) => (
        <li
          key={sighting.id}
          onClick={() => onSelect(sighting)}
          className={`p-4 cursor-pointer transition hover:bg-gray-50 ${
            selectedId === sighting.id ? "bg-orange-50" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0 ${
                animalConfig[sighting.animal_type]?.color || "bg-gray-500"
              }`}
            >
              {animalConfig[sighting.animal_type]?.emoji || "🐾"}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">
                  {animalConfig[sighting.animal_type]?.label || "동물"} 발견
                </span>
              </div>

              {sighting.image_url && (
                <img
                  src={sighting.image_url}
                  alt="신고 썸네일"
                  className="w-full h-24 object-cover rounded-xl border border-gray-200 mt-2"
                />
              )}

              {sighting.address && (() => {
                const { main, detail } = parseAddress(sighting.address);
                return (
                  <>
                    {main && <p className="text-sm text-gray-600 truncate mt-2">📍 {main}</p>}
                    {detail && <p className="text-xs text-gray-400 truncate">└ {detail}</p>}
                  </>
                );
              })()}

              {sighting.description && (
                <p className="text-sm text-gray-500 truncate mt-1">{sighting.description}</p>
              )}

              <p className="text-xs text-gray-400 mt-1">{formatDate(sighting.created_at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}


// =============================================
// 오른쪽 신고 목록 패널
// =============================================
function SightingListPanel({
  sightings,
  selectedId,
  onSelect,
  isExpanded,
  onToggle,
}: {
  sightings: Sighting[];
  selectedId: number | null;
  onSelect: (sighting: Sighting) => void;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      {/* ===== PC: 오른쪽 사이드 패널 ===== */}
      <div className="hidden lg:flex w-96 bg-white border-l border-gray-200 flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-lg text-gray-900">
            신고 목록 ({sightings.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sightings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-4xl mb-4">🔍</p>
              <p>이 지역에 신고가 없습니다</p>
            </div>
          ) : (
            <SightingList sightings={sightings} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      </div>

      {/* ===== 모바일: 바텀시트 ===== */}
      <div
        className={`
          lg:hidden fixed bottom-0 left-0 right-0 z-[900]
          bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isExpanded ? "h-[65dvh]" : "h-[12dvh]"}
        `}
      >
        {/* 손잡이 + 헤더 */}
        <div className="cursor-pointer select-none" onClick={onToggle}>
          <div className="flex justify-center pt-2 pb-1">
            <div className="w-10 h-1.5 rounded-full bg-gray-300" />
          </div>

          <div className="px-4 py-2 flex items-center justify-between">
            <h2 className="font-semibold text-base text-gray-900">
              신고 목록 ({sightings.length})
            </h2>
            <span className="text-gray-400 text-xs">
              {isExpanded ? "▼ 접기" : "▲ 펼치기"}
            </span>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto border-t border-gray-100">
          {sightings.length === 0 ? (
            <div className="p-5 text-center text-gray-500">
              <p className="text-3xl mb-4">🔍</p>
              <p>이 지역에 신고가 없습니다</p>
            </div>
          ) : (
            <SightingList sightings={sightings} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      </div>
    </>
  );
}

// =============================================
// 메인 페이지
// =============================================
export default function Home() {
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [visibleSightings, setVisibleSightings] = useState<Sighting[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [selectedSightingId, setSelectedSightingId] = useState<number | null>(null);
  const [focusedSighting, setFocusedSighting] = useState<Sighting | null>(null);
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);



  const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer&autoload=false`;

  useEffect(() => {
    api.get<CurrentUser>("/me")
      .then((response) => setCurrentUser(response.data))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false));
  }, []);

  useEffect(() => {
    api.get<Sighting[]>("/sightings")
      .then((response) => setSightings(response.data))
      .catch((err) => console.error("신고 데이터 요청 실패:", err));
  }, []);

  const handleScriptLoad = () => {
    window.kakao.maps.load(() => setLoading(false));
  };
  // 이미 SDK가 로드되어 있을 경우를 위한 처리
  useEffect(() => {
      if (window.kakao && window.kakao.maps) {
          setLoading(false);
      }
  }, []);

  const filteredSightings = filter === "all"
    ? sightings
    : sightings.filter((s) => s.animal_type === filter);

  // MapWithLogic에서 bounds 변경 시 호출됨
  const handleBoundsChange = useCallback((visible: Sighting[]) => {
    setVisibleSightings(visible);
  }, []);

  const handleSightingSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
    setFocusedSighting({ ...sighting });
  };
  const handleMarkerSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
  };

  return (
    <>
      <Script src={KAKAO_SDK_URL} strategy="afterInteractive" onLoad={handleScriptLoad} />
            {/* 이미지 풀스크린 모달 */}
      {fullImageUrl && (
        <div
          className="fixed inset-0 z-[2000] bg-black/80 flex items-center justify-center p-4"
          onClick={() => setFullImageUrl(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 text-white rounded-full flex items-center justify-center hover:bg-white/40 transition-colors text-lg"
            onClick={() => setFullImageUrl(null)}
          >
            ✕
          </button>

          <img
            src={fullImageUrl}
            alt="신고 이미지 크게 보기"
            className="max-w-full max-h-[85vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
      <main className="w-full h-[100dvh] overflow-hidden bg-gray-50 flex flex-col">
        <Header currentUser={currentUser} authLoading={authLoading} />

            <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden relative">

  {/* 지도 영역 */}
          <div className="flex-1 min-h-0 relative">
            <div className="absolute top-4 left-4 z-[1000] flex gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-md transition ${
                  filter === "all" ? "bg-gray-900 text-white" : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                전체
              </button>
              {(["CAT", "DOG", "OTHER"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setFilter(type)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-md transition flex items-center gap-1 ${
                    filter === type ? `${animalConfig[type].color} text-white` : "bg-white text-gray-700 hover:bg-gray-100"
                  }`}
                >
                  {animalConfig[type].emoji} {animalConfig[type].label}
                </button>
              ))}
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center w-full h-full text-gray-600">
                <div className="animate-bounce text-4xl mb-4">🗺️</div>
                <div className="text-lg font-semibold animate-pulse">멍냥신고 지도 로딩 중...</div>
              </div>
            ) : (
              <KakaoMap center={{ lat: 37.5665, lng: 126.9780 }} style={{ width: "100%", height: "100%" }} level={8}>
                <MapWithLogic
                  sightings={filteredSightings}
                  onBoundsChange={handleBoundsChange}
                  focusedSighting={focusedSighting}
                  onMarkerSelect={handleMarkerSelect}
                  onImageClick={(url) => setFullImageUrl(url)}
                />
              </KakaoMap>
            )}
          </div>

          {/* 목록 패널 - 모바일: 바텀시트 / PC: 오른쪽 사이드 */}
          <SightingListPanel
            sightings={visibleSightings}
            selectedId={selectedSightingId}
            onSelect={handleSightingSelect}
            isExpanded={isListExpanded}
            onToggle={() => setIsListExpanded(!isListExpanded)}
          />
        </div>
      </main>
    </>
  );
}