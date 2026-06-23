"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Map as KakaoMap, MapMarker } from "react-kakao-maps-sdk";

import type { Sighting } from "@/types/sighting";
import {
  animalConfig,
  statusConfig,
  postTypeConfig,
  formatDate,
  formatDateShort,
  parseAddress,
  getKakaoMapSearchLink,
  openKakaoMapSearch,
  formatDistance,
  isEdited,
  type RelatedSightingResult,
} from "@/lib/sightingUtils";

import { useRouter } from "next/navigation";


interface SightingDetailModalProps {
  sighting: Sighting;
  currentUserId: number | null;
  relatedSightings: RelatedSightingResult[];
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
  onStatusChange: (sightingId: number, newStatus: string) => void;
  onDelete: (sightingId: number) => void;
  onRelatedClick: (sighting: Sighting) => void;
}



const ALLOWED_STATUSES_BY_POST_TYPE: Record<string, string[]> = {
  SIGHTING: ["SPOTTED", "PROTECTING", "FOUND"],
  LOST: ["LOST", "PROTECTING", "FOUND"],
};

export default function SightingDetailModal({
  sighting,
  currentUserId,
  relatedSightings,
  onClose,
  onImageClick,
  onStatusChange,
  onDelete,
  onRelatedClick,
}: SightingDetailModalProps) {
  const router = useRouter();
  const [kakaoReady, setKakaoReady] = useState(false);

  const { main, detail } = parseAddress(sighting.address);
  const [statusLoading, setStatusLoading] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // 글이 바뀌면 스크롤 맨 위로 + 전환 효과
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }

    setIsTransitioning(true);
    const timer = setTimeout(() => setIsTransitioning(false), 300);

    return () => clearTimeout(timer);
  }, [sighting.id]);

  useEffect(() => {
  const checkKakao = () => {
      if (
        typeof window !== "undefined" &&
        window.kakao &&
        window.kakao.maps
      ) {
        setKakaoReady(true);
        return true;
      }
      return false;
    };

    if (!checkKakao()) {
      const timer = setInterval(() => {
        if (checkKakao()) {
          clearInterval(timer);
        }
      }, 200);

      return () => clearInterval(timer);
    }
  }, []);

  const statusInfo = statusConfig[sighting.status] || {
    label: sighting.status,
    color: "bg-gray-100 text-gray-700",
    bgColor: "bg-gray-500",
  };

  const isOwner = currentUserId !== null && currentUserId === sighting.user_id;

  const allowedStatuses = ALLOWED_STATUSES_BY_POST_TYPE[sighting.post_type] || ALLOWED_STATUSES_BY_POST_TYPE["SIGHTING"];

  const handleStatusChange = async (newStatus: string) => {
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await onStatusChange(sighting.id, newStatus);
    } finally {
      setStatusLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[1500] bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        ref={scrollRef}
        className={`bg-white rounded-2xl w-full max-w-md max-h-[85dvh] overflow-y-auto shadow-xl transition-opacity duration-100 ${
          isTransitioning ? "opacity-0" : "opacity-100"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {sighting.image_url ? (
          <img
            src={sighting.image_url}
            alt="신고 이미지"
            className="w-full h-56 object-cover rounded-t-2xl cursor-pointer"
            onClick={() => onImageClick(sighting.image_url!)}
          />
        ) : (
          <div className="w-full h-32 bg-gray-100 rounded-t-2xl flex items-center justify-center text-gray-400 text-4xl">
            {animalConfig[sighting.animal_type]?.emoji || "🐾"}
          </div>
        )}

        <div className="p-5 space-y-4">
          {/* 상단: 동물 종류 + 상태 뱃지 */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
                animalConfig[sighting.animal_type]?.color || "bg-gray-500"
              }`}>
                {animalConfig[sighting.animal_type]?.emoji || "🐾"}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {animalConfig[sighting.animal_type]?.label || "동물"}
                  {sighting.post_type === "LOST" ? " 실종" : " 발견"}
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(sighting.created_at)}
                  {isEdited(sighting.created_at, sighting.updated_at) && (
                    <span className="ml-1 text-gray-400">
                      (수정됨 {formatDate(sighting.updated_at)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-end gap-1">
              {(() => {
                const typeConf = postTypeConfig[sighting.post_type] || postTypeConfig["SIGHTING"];
                return (
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${typeConf.color}`}>
                    {typeConf.emoji} {typeConf.label}
                  </span>
                );
              })()}
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            </div>
          </div>

          {/* 주소 */}
          {/* 미니 지도 */}
          {kakaoReady && (
            <div className="rounded-xl overflow-hidden border border-gray-200">
              <KakaoMap
                center={{ lat: sighting.latitude, lng: sighting.longitude }}
                level={4}
                style={{ width: "100%", height: "180px" }}

              >
                <MapMarker
                  position={{ lat: sighting.latitude, lng: sighting.longitude }}
                />
              </KakaoMap>
            </div>
          )}

          {/* 주소 */}
          {(main || detail) && (
            <a
              href={getKakaoMapSearchLink([main, detail].filter(Boolean).join(" "))}
              className="block bg-gray-50 rounded-xl p-3 hover:bg-gray-100 transition-colors cursor-pointer group"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openKakaoMapSearch([main, detail].filter(Boolean).join(" "));
              }}
            >
              {main && (
                <p className="text-base font-semibold text-blue-700 underline underline-offset-4 decoration-blue-300 group-hover:text-blue-800 group-hover:decoration-blue-500 transition-colors">
                  📍 {main}
                </p>
              )}
              {detail && (
                <p className="text-xs text-gray-500 mt-2">
                  └ {detail}
                </p>
              )}
              <p className="text-[11px] text-blue-500 mt-2 font-medium">
                탭하면 카카오맵에서 이 위치를 검색합니다
              </p>
            </a>
          )}
          {/* 설명 */}
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">설명</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {sighting.description || "등록된 설명이 없습니다."}
            </p>
          </div>

          {/* 작성자 전용: 상태 변경 */}
          {isOwner && (
            <div className="border-t border-gray-100 pt-3">
              <p className="text-xs font-medium text-gray-500 mb-2">상태 변경</p>
              <div className="flex gap-2 flex-wrap">
                {allowedStatuses
                  .filter((s) => s !== sighting.status)
                  .map((s) => (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusLoading}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition
                        ${statusConfig[s]?.color || "bg-gray-100 text-gray-700"}
                        border-transparent hover:opacity-80 disabled:opacity-50`}
                    >
                      {statusLoading ? "변경 중..." : `→ ${statusConfig[s]?.label}`}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* 작성자 전용: 삭제 */}
          {/* 작성자 전용: 수정 / 삭제 */}
          {isOwner && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <button
                onClick={() => {
                  onClose();
                  router.push(`/sightings/${sighting.id}/edit`);
                }}
                className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 transition-colors"
              >
                ✏️ 이 글 수정하기
              </button>

              <button
                onClick={() => {
                  if (window.confirm("정말 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.")) {
                    onDelete(sighting.id);
                  }
                }}
                className="w-full py-2 text-sm font-medium text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                🗑️ 이 글 삭제하기
              </button>
            </div>
          )}

          {/* 관련 글 추천 */}
          {relatedSightings.length > 0 && (
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">
                {sighting.post_type === "LOST"
                  ? "이 근처에서 확인된 관련 목격 글"
                  : "이 근처의 관련 실종 글"}
              </p>

              <div className="space-y-2">
                {relatedSightings.map(({ sighting: related, distanceMeters, matchedFeatures }) => {
                  const relatedType =
                    postTypeConfig[related.post_type] || postTypeConfig["SIGHTING"];
                  const relatedStatus =
                    statusConfig[related.status] || {
                      label: related.status,
                      color: "bg-gray-100 text-gray-700",
                    };

                  return (
                    <div
                      key={related.id}
                      className="rounded-xl border border-gray-200 bg-gray-50 p-3 cursor-pointer hover:bg-gray-100 active:bg-gray-200 transition-colors"
                      onClick={() => onRelatedClick(related)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${relatedType.color}`}
                            >
                              {relatedType.emoji} {relatedType.label}
                            </span>
                            <span
                              className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${relatedStatus.color}`}
                            >
                              {relatedStatus.label}
                            </span>
                          </div>

                          <p className="text-sm font-medium text-gray-900">
                            {animalConfig[related.animal_type]?.label || "동물"}
                            {related.post_type === "LOST" ? " 실종" : " 발견"}
                          </p>

                          {related.description && (
                            <p className="text-sm text-gray-600 line-clamp-2 mt-1">
                              {related.description}
                            </p>
                          )}

                          {related.address && (() => {
                            const relatedAddr = parseAddress(related.address);
                            return relatedAddr.main ? (
                              <p className="text-xs text-gray-500 mt-1 truncate">
                                📍 {relatedAddr.main}
                              </p>
                            ) : null;
                          })()}

                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-gray-500">
                            <span>{formatDistance(distanceMeters)}</span>
                            <span>·</span>
                            <span>{formatDateShort(related.created_at)}</span>
                          </div>

                          {matchedFeatures.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {matchedFeatures.map((feature) => (
                                <span
                                  key={`${related.id}-${feature}`}
                                  className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"
                                >
                                  #{feature}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {related.image_url ? (
                          <img
                            src={related.image_url}
                            alt="관련 글 썸네일"
                            className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-lg border border-gray-200 bg-white flex items-center justify-center text-2xl flex-shrink-0">
                            {animalConfig[related.animal_type]?.emoji || "🐾"}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* 신고 번호 + 작성자 */}
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs text-gray-400">신고 번호: #{sighting.id}</p>
            {sighting.user_nickname && (
              <p className="text-xs text-gray-500">작성자: {sighting.user_nickname}</p>
            )}
          </div>

          {/* 닫기 */}
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}