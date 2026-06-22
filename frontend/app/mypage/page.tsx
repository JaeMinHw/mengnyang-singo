"use client";

import { useEffect, useState, useMemo } from "react";

import api from "@/lib/api";
import Header from "@/components/Header";
import SightingList from "@/components/SightingList";
import SightingDetailModal from "@/components/SightingDetailModal";
import type { CurrentUser, Sighting } from "@/types/sighting";
import {
  getRelatedSightings,
  type RelatedSightingResult,
} from "@/lib/sightingUtils";

export default function MyPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mySightings, setMySightings] = useState<Sighting[]>([]);
  const [allSightings, setAllSightings] = useState<Sighting[]>([]);
  const [selectedSightingId, setSelectedSightingId] = useState<number | null>(null);
  const [detailSighting, setDetailSighting] = useState<Sighting | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<CurrentUser>("/me")
      .then((response) => {
        setCurrentUser(response.data);
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setAuthLoading(false);
      });
  }, []);

  useEffect(() => {
    Promise.all([
      api.get<Sighting[]>("/my-sightings"),
      api.get<Sighting[]>("/sightings"),
    ])
      .then(([myRes, allRes]) => {
        setMySightings(myRes.data);
        setAllSightings(allRes.data);
      })
      .catch((err) => {
        console.error("글 목록 요청 실패:", err);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
    setDetailSighting(sighting);
  };

  const handleStatusChange = async (sightingId: number, newStatus: string) => {
    try {
      const response = await api.patch<Sighting>(`/sightings/${sightingId}/status`, {
        status: newStatus,
      });

      const updated = response.data;

      setMySightings((prev) =>
        prev.map((s) => (s.id === sightingId ? updated : s))
      );

      setAllSightings((prev) =>
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

      setMySightings((prev) => prev.filter((s) => s.id !== sightingId));
      setAllSightings((prev) => prev.filter((s) => s.id !== sightingId));

      if (selectedSightingId === sightingId) {
        setSelectedSightingId(null);
      }

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
    return getRelatedSightings(detailSighting, allSightings);
  }, [detailSighting, allSightings]);

  const handleRelatedClick = (related: Sighting) => {
    setDetailSighting(related);
    setSelectedSightingId(related.id);
  };

  return (
    <>
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
          onRelatedClick={handleRelatedClick}
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

      <main className="min-h-[100dvh] bg-gray-50">
        <Header currentUser={currentUser} authLoading={authLoading} />

        <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">마이페이지</h1>
            <p className="text-sm text-gray-500 mt-1">
              내가 등록한 목격/실종 글을 확인할 수 있습니다.
            </p>
          </div>

          <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-4 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">내가 작성한 글</h2>
              <p className="text-sm text-gray-500 mt-1">
                삭제한 글은 여기 표시되지 않습니다.
              </p>
            </div>

            {loading ? (
              <div className="px-4 py-12 text-center text-gray-500">
                내 글 목록을 불러오는 중입니다...
              </div>
            ) : mySightings.length === 0 ? (
              <div className="px-4 py-12 text-center">
                <p className="text-gray-700 font-medium">아직 등록한 글이 없습니다.</p>
                <p className="text-sm text-gray-500 mt-2">
                  목격 또는 실종 글을 등록해보세요.
                </p>
              </div>
            ) : (
              <SightingList
                sightings={mySightings}
                selectedId={selectedSightingId}
                onSelect={handleSelect}
                searchQuery=""
              />
            )}
          </section>
        </div>
      </main>
    </>
  );
}