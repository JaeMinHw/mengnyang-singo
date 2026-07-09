"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Map as KakaoMap, MapMarker } from "react-kakao-maps-sdk";
import type { Comment } from "@/types/sighting";
import api from "@/lib/api";
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
  onStatusChange: (
    sightingId: number,
    newStatus: string,
    extra?: {
      reopen_reason?: string;
      reopen_detail?: string;
    }
  ) => void;
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


  const [activeImageIndex, setActiveImageIndex] = useState(0);
  // image_urls 우선, 없으면 image_url 폴백




  const [statusLoading, setStatusLoading] = useState(false);
  const [showReopenForm, setShowReopenForm] = useState(false);
  const { main, detail } = parseAddress(sighting.address);

  const imageUrls: string[] =
  sighting.image_urls && sighting.image_urls.length > 0
    ? sighting.image_urls
    : sighting.image_url
    ? [sighting.image_url]
    : [];

    
  const [pendingStatus, setPendingStatus] = useState<string | null>(null);
  const [reopenReason, setReopenReason] = useState<
    "WRONG_ANIMAL" | "NOT_FOUND_YET" | "MISTAKE" | "OTHER" | null
  >(null);
  const [reopenDetail, setReopenDetail] = useState("");

  const scrollRef = useRef<HTMLDivElement>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [commentImageFile, setCommentImageFile] = useState<File | null>(null);
  const [commentImagePreview, setCommentImagePreview] = useState<string | null>(null);
  const [commentSubmitting, setCommentSubmitting] = useState(false);
  const commentFileRef = useRef<HTMLInputElement>(null);

  const [editingCommentId, setEditingCommentId] = useState<number | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const editFileRef = useRef<HTMLInputElement>(null);

  const activeImageUrl = imageUrls[activeImageIndex] ?? null;

  // 글이 바뀌면 스크롤 맨 위로 + 전환 효과
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }

    setActiveImageIndex(0); // ← 추가
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

  useEffect(() => {
    if (!sighting.id) return;

    setCommentsLoading(true);

    api
      .get<Comment[]>(`/sightings/${sighting.id}/comments`)
      .then((res) => setComments(res.data))
      .catch((err) => console.error("댓글 로딩 실패:", err))
      .finally(() => setCommentsLoading(false));
  }, [sighting.id]);

  const statusInfo = statusConfig[sighting.status] || {
    label: sighting.status,
    color: "bg-gray-100 text-gray-700",
    bgColor: "bg-gray-500",
  };
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const isOwner = currentUserId !== null && currentUserId === sighting.user_id;

  const allowedStatuses = ALLOWED_STATUSES_BY_POST_TYPE[sighting.post_type] || ALLOWED_STATUSES_BY_POST_TYPE["SIGHTING"];

  const handleStatusChange = async (newStatus: string) => {
  // FOUND에서 다른 상태로 되돌리는 경우 → 사유 폼 먼저
    if (sighting.status === "FOUND" && newStatus !== "FOUND") {
      setPendingStatus(newStatus);
      setShowReopenForm(true);
      setReopenReason(null);
      setReopenDetail("");
      return;
    }

    // 그 외: 바로 API 호출
    if (statusLoading) return;
    setStatusLoading(true);
    try {
      await onStatusChange(sighting.id, newStatus);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReopenConfirm = async () => {
    if (!pendingStatus || !reopenReason) return;

    if (reopenReason === "OTHER" && !reopenDetail.trim()) {
      alert("기타 사유를 입력해주세요.");
      return;
    }

    if (statusLoading) return;
    setStatusLoading(true);

    try {
      await onStatusChange(sighting.id, pendingStatus, {
        reopen_reason: reopenReason,
        reopen_detail: reopenReason === "OTHER" ? reopenDetail.trim() : undefined,
      });

      setShowReopenForm(false);
      setPendingStatus(null);
      setReopenReason(null);
      setReopenDetail("");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleReopenCancel = () => {
    setShowReopenForm(false);
    setPendingStatus(null);
    setReopenReason(null);
    setReopenDetail("");
  };

  const handleCommentImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (commentImagePreview) {
    URL.revokeObjectURL(commentImagePreview);
  }

  setCommentImageFile(file);
  setCommentImagePreview(URL.createObjectURL(file));
};

const handleCommentImageRemove = () => {
  if (commentImagePreview) {
    URL.revokeObjectURL(commentImagePreview);
  }
  setCommentImageFile(null);
  setCommentImagePreview(null);
  if (commentFileRef.current) {
    commentFileRef.current.value = "";
  }
};

const handleCommentSubmit = async () => {
  const hasText = newComment.trim().length > 0;
  const hasImage = commentImageFile !== null;

  if (!hasText && !hasImage) return;

  setCommentSubmitting(true);

  try {
    let uploadedImageUrl: string | null = null;

    if (commentImageFile) {
      const formData = new FormData();
      formData.append("file", commentImageFile);

      const uploadRes = await api.post<{ image_url: string }>(
        "/upload/image",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      uploadedImageUrl = uploadRes.data.image_url;
    }

    const res = await api.post<Comment>(`/sightings/${sighting.id}/comments`, {
      content: hasText ? newComment.trim() : null,
      image_url: uploadedImageUrl,
    });

    setComments((prev) => [res.data, ...prev]);

    setNewComment("");
    handleCommentImageRemove();
  } catch (err: any) {
    console.error("댓글 작성 실패:", err);

    if (err?.response?.status === 401) {
      alert("로그인이 필요합니다.");
    } else {
      alert("댓글 작성에 실패했습니다.");
    }
  } finally {
    setCommentSubmitting(false);
  }
};

const handleEditStart = (comment: Comment) => {
  setEditingCommentId(comment.id);
  setEditingContent(comment.content || "");
  setEditingImagePreview(comment.image_url);
  setEditingImageFile(null);
};

const handleEditCancel = () => {
  if (editingImagePreview && editingImagePreview.startsWith("blob:")) {
    URL.revokeObjectURL(editingImagePreview);
  }
  setEditingCommentId(null);
  setEditingContent("");
  setEditingImageFile(null);
  setEditingImagePreview(null);
  if (editFileRef.current) {
    editFileRef.current.value = "";
  }
};

const handleEditImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  if (editingImagePreview && editingImagePreview.startsWith("blob:")) {
    URL.revokeObjectURL(editingImagePreview);
  }

  setEditingImageFile(file);
  setEditingImagePreview(URL.createObjectURL(file));
};

const handleEditImageRemove = () => {
  if (editingImagePreview && editingImagePreview.startsWith("blob:")) {
    URL.revokeObjectURL(editingImagePreview);
  }
  setEditingImageFile(null);
  setEditingImagePreview(null);
  if (editFileRef.current) {
    editFileRef.current.value = "";
  }
};

const handleEditSubmit = async (commentId: number, existingImageUrl: string | null) => {
  const hasText = editingContent.trim().length > 0;
  const hasNewImage = editingImageFile !== null;
  const hasExistingImage = editingImagePreview !== null && !editingImagePreview.startsWith("blob:");
  const hasImage = hasNewImage || hasExistingImage;

  if (!hasText && !hasImage) {
    alert("댓글 내용 또는 이미지를 입력해주세요.");
    return;
  }

  setEditSubmitting(true);

  try {
    let nextImageUrl = hasExistingImage ? existingImageUrl : null;

    if (hasNewImage && editingImageFile) {
      const formData = new FormData();
      formData.append("file", editingImageFile);

      const uploadRes = await api.post<{ image_url: string }>(
        "/upload/image",
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      nextImageUrl = uploadRes.data.image_url;
    } else if (!hasExistingImage) {
      nextImageUrl = null;
    }

    const res = await api.patch<Comment>(`/comments/${commentId}`, {
      content: hasText ? editingContent.trim() : null,
      image_url: nextImageUrl,
    });

    setComments((prev) =>
      prev.map((c) => (c.id === commentId ? res.data : c))
    );

    handleEditCancel();
  } catch (err: any) {
    console.error("댓글 수정 실패:", err);

    if (err?.response?.status === 403) {
      alert("본인이 작성한 댓글만 수정할 수 있습니다.");
    } else {
      alert("댓글 수정에 실패했습니다.");
    }
  } finally {
    setEditSubmitting(false);
  }
};

  const handleCommentDelete = async (commentId: number) => {
    if (!window.confirm("댓글을 삭제하시겠습니까?")) return;

    try {
      await api.delete(`/comments/${commentId}`);

      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err: any) {
      console.error("댓글 삭제 실패:", err);

      if (err?.response?.status === 403) {
        alert("본인이 작성한 댓글만 삭제할 수 있습니다.");
      } else {
        alert("댓글 삭제에 실패했습니다.");
      }
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
          {imageUrls.length > 0 ? (
          <div>
            {/* 대표 이미지 */}
            <img
              src={activeImageUrl!}
              alt="신고 이미지"
              className="w-full h-56 object-cover rounded-t-2xl cursor-pointer"
              onClick={() => onImageClick(activeImageUrl!)}
            />

            {/* 썸네일 목록 - 2장 이상일 때만 표시 */}
            {imageUrls.length > 1 && (
              <div className="flex gap-2 px-3 py-2 bg-gray-50 overflow-x-auto">
                {imageUrls.map((url, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setActiveImageIndex(index)}
                    className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-colors ${
                      index === activeImageIndex
                        ? "border-blue-500"
                        : "border-transparent hover:border-gray-300"
                    }`}
                  >
                    <img
                      src={url}
                      alt={`이미지 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
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

              {showReopenForm ? (
                /* 되돌리기 사유 폼 */
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-3">
                  <p className="text-xs font-semibold text-amber-800">
                    ⚠️ 찾음 상태를 되돌리는 이유를 선택해주세요
                  </p>

                  <div className="space-y-2">
                    {[
                      { value: "WRONG_ANIMAL", label: "다른 동물이었습니다" },
                      { value: "NOT_FOUND_YET", label: "아직 찾지 못했습니다" },
                      { value: "MISTAKE", label: "실수로 상태를 변경했습니다" },
                      { value: "OTHER", label: "기타" },
                    ].map((option) => (
                      <label
                        key={option.value}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="reopen_reason"
                          value={option.value}
                          checked={reopenReason === option.value}
                          onChange={() =>
                            setReopenReason(
                              option.value as typeof reopenReason
                            )
                          }
                          className="accent-amber-500"
                        />
                        <span className="text-sm text-gray-700">{option.label}</span>
                      </label>
                    ))}
                  </div>

                  {reopenReason === "OTHER" && (
                    <textarea
                      value={reopenDetail}
                      onChange={(e) => setReopenDetail(e.target.value)}
                      placeholder="사유를 직접 입력해주세요"
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-black outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-100 resize-none"
                    />
                  )}

                  <div className="flex gap-2">
                    <button
                      onClick={handleReopenCancel}
                      className="flex-1 py-2 rounded-lg text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 transition-colors"
                    >
                      취소
                    </button>
                    <button
                      onClick={handleReopenConfirm}
                      disabled={
                        statusLoading ||
                        !reopenReason ||
                        (reopenReason === "OTHER" && !reopenDetail.trim())
                      }
                      className="flex-1 py-2 rounded-lg text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                    >
                      {statusLoading ? "변경 중..." : "확인"}
                    </button>
                  </div>
                </div>
              ) : (
                /* 일반 상태 변경 버튼 */
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
              )}
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

          {/* 비작성자: 작성자와 채팅 */}
          {!isOwner && currentUserId && (
            <div className="border-t border-gray-100 pt-3">
              <button
                onClick={async () => {
                  try {
                    const res = await api.post("/chat/rooms/open", {
                      sighting_id: sighting.id,
                      target_user_id: sighting.user_id,
                    });
                    onClose();
                    router.push(`/chats/${res.data.id}`);
                  } catch (err: any) {
                    console.error("채팅방 열기 실패:", err);
                    alert(
                      err?.response?.data?.detail ||
                        "채팅을 시작할 수 없습니다."
                    );
                  }
                }}
                className="w-full py-2 text-sm font-medium text-green-600 bg-green-50 rounded-xl hover:bg-green-100 transition-colors"
              >
                💬 작성자와 채팅하기
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

          {/* 댓글 섹션 */}
            <div className="border-t border-gray-100 pt-4">
              <p className="text-sm font-semibold text-gray-800 mb-3">
                댓글 {comments.length > 0 && (
                  <span className="text-gray-400 font-normal">({comments.length})</span>
                )}
              </p>

              {/* 댓글 작성 폼 */}
                {currentUserId && (
                  <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      placeholder="댓글을 입력해주세요"
                      rows={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-black outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
                    />

                    {commentImagePreview ? (
                      <div className="relative">
                        <img
                          src={commentImagePreview}
                          alt="댓글 이미지 미리보기"
                          className="w-full max-h-36 object-cover rounded-lg border border-gray-200"
                        />
                        <button
                          type="button"
                          onClick={handleCommentImageRemove}
                          className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : null}

                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => commentFileRef.current?.click()}
                        className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                      >
                        📷 사진 첨부
                      </button>

                      <button
                        type="button"
                        onClick={handleCommentSubmit}
                        disabled={
                          commentSubmitting ||
                          (!newComment.trim() && !commentImageFile)
                        }
                        className="px-4 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                      >
                        {commentSubmitting ? "등록 중..." : "등록"}
                      </button>
                    </div>

                    <input
                      ref={commentFileRef}
                      type="file"
                      accept="image/*"
                      onChange={handleCommentImageSelect}
                      className="hidden"
                    />
                  </div>
                )}

              {commentsLoading ? (
                <div className="text-sm text-gray-400 text-center py-4">
                  댓글을 불러오는 중입니다...
                </div>
              ) : comments.length === 0 ? (
                <div className="text-sm text-gray-400 text-center py-4">
                  아직 댓글이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {comments.map((comment) => {
                    const isCommentOwner = currentUserId !== null && currentUserId === comment.user_id;
                    const isEditing = editingCommentId === comment.id;

                    return (
                      <div
                        key={comment.id}
                        className="bg-gray-50 rounded-xl p-3"
                      >
                        {/* 작성자 + 시간 + 수정/삭제 */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-medium text-gray-700">
                            {comment.user_nickname || "익명"}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">
                              {formatDate(comment.created_at)}
                              {isEdited(comment.created_at, comment.updated_at) && (
                                <span className="ml-1">(수정됨)</span>
                              )}
                            </span>
                            {isCommentOwner && !isEditing && (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => handleEditStart(comment)}
                                  className="text-xs text-blue-500 hover:text-blue-700 transition-colors"
                                >
                                  수정
                                </button>
                                <button
                                  onClick={() => handleCommentDelete(comment.id)}
                                  className="text-xs text-red-400 hover:text-red-600 transition-colors"
                                >
                                  삭제
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {isEditing ? (
                          /* 수정 모드 */
                          <div className="space-y-2">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows={2}
                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-black outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-100 resize-none"
                            />

                            {editingImagePreview ? (
                              <div className="relative">
                                <img
                                  src={editingImagePreview}
                                  alt="수정 이미지 미리보기"
                                  className="w-full max-h-36 object-cover rounded-lg border border-gray-200"
                                />
                                <button
                                  type="button"
                                  onClick={handleEditImageRemove}
                                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors text-xs"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : null}

                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => editFileRef.current?.click()}
                                className="text-xs text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
                              >
                                📷 사진 변경
                              </button>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={handleEditCancel}
                                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 hover:bg-gray-200 transition-colors"
                                >
                                  취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleEditSubmit(comment.id, comment.image_url)}
                                  disabled={
                                    editSubmitting ||
                                    (!editingContent.trim() && !editingImagePreview)
                                  }
                                  className="px-3 py-1.5 rounded-lg bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors"
                                >
                                  {editSubmitting ? "저장 중..." : "저장"}
                                </button>
                              </div>
                            </div>

                            <input
                              ref={editFileRef}
                              type="file"
                              accept="image/*"
                              onChange={handleEditImageSelect}
                              className="hidden"
                            />
                          </div>
                        ) : (
                          /* 일반 모드 */
                          <>
                            {comment.image_url && (
                              <img
                                src={comment.image_url}
                                alt="댓글 이미지"
                                className="w-full max-h-48 object-cover rounded-lg mb-2 cursor-pointer"
                                onClick={() => onImageClick(comment.image_url!)}
                              />
                            )}

                            {comment.content && (
                              <p className="text-sm text-gray-700 leading-relaxed">
                                {comment.content}
                              </p>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 기록 정보 */}

            {(sighting.resolved_at || sighting.reopen_reason) && (
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500">기록 정보</p>

                {sighting.resolved_at && (
                  <div className="bg-green-50 rounded-xl p-3">
                    <p className="text-xs text-green-700">
                      ✅ 찾음 처리: {formatDate(sighting.resolved_at)}
                    </p>
                  </div>
                )}

                {sighting.reopen_reason && (
                  <div className="bg-amber-50 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-medium text-amber-700">
                      ⚠️ 이전에 찾음 상태를 되돌린 이력이 있습니다
                    </p>
                    <p className="text-xs text-amber-600">
                      사유:{" "}
                      {
                        {
                          WRONG_ANIMAL: "다른 동물이었습니다",
                          NOT_FOUND_YET: "아직 찾지 못했습니다",
                          MISTAKE: "실수로 상태를 변경했습니다",
                          OTHER: "기타",
                        }[sighting.reopen_reason] ?? sighting.reopen_reason
                      }
                    </p>
                    {sighting.reopen_detail && (
                      <p className="text-xs text-amber-500">
                        └ {sighting.reopen_detail}
                      </p>
                    )}
                  </div>
                )}
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