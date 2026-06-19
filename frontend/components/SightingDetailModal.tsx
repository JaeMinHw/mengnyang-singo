"use client";

import { useState } from "react";
import type { Sighting } from "@/types/sighting";
import {
  animalConfig,
  statusConfig,
  postTypeConfig,
  formatDate,
  parseAddress,
  getKakaoMapSearchLink,
  openKakaoMapSearch,
} from "@/lib/sightingUtils";




interface SightingDetailModalProps {
  sighting: Sighting;
  currentUserId: number | null;
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
  onStatusChange: (sightingId: number, newStatus: string) => void;
}



const ALLOWED_STATUSES_BY_POST_TYPE: Record<string, string[]> = {
  SIGHTING: ["SPOTTED", "PROTECTING", "FOUND"],
  LOST: ["LOST", "PROTECTING", "FOUND"],
};

export default function SightingDetailModal({
  sighting,
  currentUserId,
  onClose,
  onImageClick,
  onStatusChange,
}: SightingDetailModalProps) {
  const { main, detail } = parseAddress(sighting.address);
  const [statusLoading, setStatusLoading] = useState(false);

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
        className="bg-white rounded-2xl w-full max-w-md max-h-[85dvh] overflow-y-auto shadow-xl"
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