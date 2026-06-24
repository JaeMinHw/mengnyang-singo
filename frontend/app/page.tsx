"use client";

import { Map as KakaoMap } from "react-kakao-maps-sdk";
import Script from "next/script";
import { useEffect, useState, useCallback, useMemo } from "react";

import api from "@/lib/api";
import Header from "@/components/Header";
import type { Sighting, CurrentUser } from "@/types/sighting";
import {
  animalConfig,
  matchesSearch,
  getRelatedSightings,
  type RelatedSightingResult,
} from "@/lib/sightingUtils";

import SightingDetailModal from "@/components/SightingDetailModal";
import SightingListPanel from "@/components/SightingListPanel";
import MapWithLogic from "@/components/MapWithLogic";




export default function Home() {
  const [isListExpanded, setIsListExpanded] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [visibleSightings, setVisibleSightings] = useState<Sighting[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [postTypeFilter, setPostTypeFilter] = useState<string>("all");
  const [selectedSightingId, setSelectedSightingId] = useState<number | null>(null);
  const [focusedSighting, setFocusedSighting] = useState<Sighting | null>(null);
  const [detailSighting, setDetailSighting] = useState<Sighting | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showFound, setShowFound] = useState(false);
  const [kakaoReady, setKakaoReady] = useState(false);

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

  useEffect(() => {
    if (window.kakao && window.kakao.maps) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      window.kakao &&
      window.kakao.maps
    ) {
      setKakaoReady(true);
    }
  }, []);

  const handleStatusFilterChange = (status: string) => {
    setStatusFilter(status);

    if (status === "FOUND") {
      setShowFound(true);
      return;
    }

    if (status === "SPOTTED" || status === "PROTECTING" || status === "LOST") {
      setShowFound(false);
    }
  };

  const handleToggleShowFound = () => {
    setShowFound((prev) => {
      const next = !prev;

      if (!next && statusFilter === "FOUND") {
        setStatusFilter("all");
      }

      return next;
    });
  };

  const filteredSightings = useMemo(() => {
    return sightings.filter((s) => {
      const matchAnimal = filter === "all" || s.animal_type === filter;
      const matchPostType = postTypeFilter === "all" || s.post_type === postTypeFilter;
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchSearch = matchesSearch(s, searchQuery);
      const matchFoundVisibility =
        statusFilter === "FOUND" || showFound || s.status !== "FOUND";

      return matchAnimal && matchPostType && matchStatus && matchSearch && matchFoundVisibility;
    });
  }, [sightings, filter, postTypeFilter, statusFilter, searchQuery, showFound]);

  const handleBoundsChange = useCallback((visible: Sighting[]) => {
    setVisibleSightings((prev) => {
      if (
        prev.length === visible.length &&
        prev.every((s, i) => s.id === visible[i].id)
      ) {
        return prev;
      }
      return visible;
    });
  }, []);

  const handleSightingSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
    setFocusedSighting({ ...sighting });
    setDetailSighting(sighting);
  };

  const handleMarkerSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
  };

  const handleStatusChange = async (sightingId: number, newStatus: string) => {
    try {
      const response = await api.patch<Sighting>(`/sightings/${sightingId}/status`, {
        status: newStatus,
      });

      const updated = response.data;

      setSightings((prev) =>
        prev.map((s) => (s.id === sightingId ? updated : s))
      );

      setDetailSighting(updated);
    } catch (err) {
      console.error("상태 변경 실패:", err);
      alert("상태 변경에 실패했습니다. 다시 시도해주세요.");
    }
  };

    const handleDelete = async (sightingId: number) => {
    try {
      await api.delete(`/sightings/${sightingId}`);

      // 목록에서 즉시 제거
      setSightings((prev) => prev.filter((s) => s.id !== sightingId));

      // 모달 닫기
      setDetailSighting(null);

    } catch (err: any) {
      console.error("삭제 실패:", err);

      if (err?.response?.status === 403) {
        alert("본인이 작성한 글만 삭제할 수 있습니다.");
      } else {
        alert("삭제에 실패했습니다. 다시 시도해주세요.");
      }
    }
  };

  const relatedSightings = useMemo<RelatedSightingResult[]>(() => {
      if (!detailSighting) return [];

      return getRelatedSightings(detailSighting, sightings);
    }, [detailSighting, sightings]);
  return (
    <>
      <Script
        src={KAKAO_SDK_URL}
        strategy="afterInteractive"
        onLoad={() => {
          window.kakao.maps.load(() => {
            setLoading(false);
            setKakaoReady(true);
          });
        }}
      />

      {detailSighting && (
        <SightingDetailModal
          sighting={detailSighting}
          currentUserId={currentUser?.id ?? null}
          relatedSightings={relatedSightings}
          onClose={() => setDetailSighting(null)}
          onImageClick={(url) => {
            setDetailSighting(null);
            setFullImageUrl(url);
          }}
          onStatusChange={handleStatusChange}
          onDelete={handleDelete}
          onRelatedClick={(related) => {
            setDetailSighting(related);
            setSelectedSightingId(related.id);
            setFocusedSighting({ ...related });
          }}
        />
      )}

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
          <div className="flex-1 min-h-0 relative">
            <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2">

              {/* 동물 종류 필터 */}
              <div className="flex gap-2">
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
                      filter === type
                        ? `${animalConfig[type].color} text-white`
                        : "bg-white text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {animalConfig[type].emoji} {animalConfig[type].label}
                  </button>
                ))}
              </div>

              

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
                  onDetailClick={(sighting) => setDetailSighting(sighting)}
                />
              </KakaoMap>
            )}
          </div>

          <SightingListPanel
            sightings={visibleSightings}
            selectedId={selectedSightingId}
            onSelect={handleSightingSelect}
            isExpanded={isListExpanded}
            onToggle={() => setIsListExpanded(!isListExpanded)}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            statusFilter={statusFilter}
            onStatusFilterChange={handleStatusFilterChange}
            showFound={showFound}
            onToggleShowFound={handleToggleShowFound}
          />
        </div>
      </main>
    </>
  );
}