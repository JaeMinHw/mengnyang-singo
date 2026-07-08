"use client";

import { useEffect, useState, useMemo, useDeferredValue, useCallback } from "react";

import api from "@/lib/api";
import Header from "@/components/Header";
import SightingList from "@/components/SightingList";
import SightingDetailModal from "@/components/SightingDetailModal";

import {
  animalConfig,
  formatDate,
  getRelatedSightings,
  isEdited,
  matchesSearch,
  parseAddress,
  postTypeConfig,
  statusConfig,
  type RelatedSightingResult,
} from "@/lib/sightingUtils";

import type {
  CurrentUser,
  Sighting,
  KeywordSubscription,
  MyComment,
  MyCommentListResponse,
} from "@/types/sighting";

type TabType = "sightings" | "comments" | "keywords";

const COMMENTS_PER_PAGE = 10;

const PERIOD_OPTIONS = [
  { value: 7, label: "최근 7일" },
  { value: 30, label: "최근 30일" },
  { value: 90, label: "최근 3개월" },
  { value: 0, label: "전체" },
];

export default function MyPage() {
  const [activeTab, setActiveTab] = useState<TabType>("sightings");

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [mySightings, setMySightings] = useState<Sighting[]>([]);
  const [allSightings, setAllSightings] = useState<Sighting[]>([]);
  const [selectedSightingId, setSelectedSightingId] = useState<number | null>(null);
  const [detailSighting, setDetailSighting] = useState<Sighting | null>(null);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterAnimalType, setFilterAnimalType] = useState<string>("");
  const [filterPostType, setFilterPostType] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [includeArchived, setIncludeArchived] = useState(false);

  const deferredSearchQuery = useDeferredValue(searchQuery);
  const isSearchPending = searchQuery !== deferredSearchQuery;

  const animalTypeOptions = [
    { value: "", label: "전체 동물" },
    { value: "CAT", label: "고양이" },
    { value: "DOG", label: "개" },
    { value: "OTHER", label: "기타" },
  ];

  const [myComments, setMyComments] = useState<MyComment[]>([]);
  const [myCommentsTotal, setMyCommentsTotal] = useState(0);
  const [myCommentsLoading, setMyCommentsLoading] = useState(false);
  const [commentPeriod, setCommentPeriod] = useState(30);
  const [commentOffset, setCommentOffset] = useState(0);
  const [openingCommentSightingId, setOpeningCommentSightingId] = useState<number | null>(null);

  const [keywords, setKeywords] = useState<KeywordSubscription[]>([]);
  const [newKeyword, setNewKeyword] = useState("");
  const [keywordLoading, setKeywordLoading] = useState(false);

  useEffect(() => {
    api
      .get<CurrentUser>("/me")
      .then((response) => setCurrentUser(response.data))
      .catch(() => setCurrentUser(null))
      .finally(() => setAuthLoading(false));
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
      .catch((err) => console.error("글 목록 요청 실패:", err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api
      .get<KeywordSubscription[]>("/keywords")
      .then((res) => setKeywords(res.data))
      .catch((err) => console.error("키워드 조회 실패:", err));
  }, []);

  const fetchMyComments = useCallback(
    async (period: number, offset: number, append: boolean) => {
      setMyCommentsLoading(true);

      try {
        const params: Record<string, number> = {
          limit: COMMENTS_PER_PAGE,
          offset,
        };

        if (period > 0) {
          params.days = period;
        }

        const res = await api.get<MyCommentListResponse>("/my-comments", { params });

        if (append) {
          setMyComments((prev) => [...prev, ...res.data.items]);
        } else {
          setMyComments(res.data.items);
        }

        setMyCommentsTotal(res.data.total);
      } catch (err) {
        console.error("내 댓글 조회 실패:", err);
      } finally {
        setMyCommentsLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (activeTab === "comments") {
      setCommentOffset(0);
      fetchMyComments(commentPeriod, 0, false);
    }
  }, [activeTab, commentPeriod, fetchMyComments]);

  const handleLoadMoreComments = () => {
    const nextOffset = commentOffset + COMMENTS_PER_PAGE;
    setCommentOffset(nextOffset);
    fetchMyComments(commentPeriod, nextOffset, true);
  };

  const hasMoreComments = myComments.length < myCommentsTotal;

  const handleSelect = (sighting: Sighting) => {
    setSelectedSightingId(sighting.id);
    setDetailSighting(sighting);
  };

  const handleStatusChange = async (
    sightingId: number,
    newStatus: string,
    extra?: { reopen_reason?: string; reopen_detail?: string }
  ) => {
    try {
      const response = await api.patch<Sighting>(`/sightings/${sightingId}/status`, {
        status: newStatus,
        ...extra,
      });

      const updated = response.data;
      setMySightings((prev) => prev.map((s) => (s.id === sightingId ? updated : s)));
      setAllSightings((prev) => prev.map((s) => (s.id === sightingId ? updated : s)));
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
      if (selectedSightingId === sightingId) setSelectedSightingId(null);
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

  const ARCHIVE_THRESHOLD_DAYS = 30;

  const filteredSightings = useMemo(() => {
    const now = new Date();

    return mySightings.filter((s) => {
      if (!includeArchived) {
        if (s.status === "FOUND" && s.resolved_at) {
          const resolvedAt = new Date(s.resolved_at);
          const diffDays = (now.getTime() - resolvedAt.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays >= ARCHIVE_THRESHOLD_DAYS) return false;
        }
      }
      if (filterAnimalType && s.animal_type !== filterAnimalType) return false;
      if (filterPostType && s.post_type !== filterPostType) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (deferredSearchQuery.trim()) {
        if (!matchesSearch(s, deferredSearchQuery)) return false;
      }
      return true;
    });
  }, [mySightings, deferredSearchQuery, filterAnimalType, filterPostType, filterStatus, includeArchived]);

  const relatedSightings = useMemo<RelatedSightingResult[]>(() => {
    if (!detailSighting) return [];
    return getRelatedSightings(detailSighting, allSightings);
  }, [detailSighting, allSightings]);

  const handleRelatedClick = (related: Sighting) => {
    setDetailSighting(related);
    setSelectedSightingId(related.id);
  };

  const handleMyCommentClick = async (comment: MyComment) => {
    if (openingCommentSightingId === comment.sighting_id) return;

    setSelectedSightingId(comment.sighting_id);

    const existing = [detailSighting, ...mySightings, ...allSightings]
      .filter((item): item is Sighting => Boolean(item))
      .find((item) => item.id === comment.sighting_id);

    if (existing) {
      setDetailSighting(existing);
      return;
    }

    setOpeningCommentSightingId(comment.sighting_id);
    try {
      const res = await api.get<Sighting>(`/sightings/${comment.sighting_id}`);
      setDetailSighting(res.data);
    } catch (err) {
      console.error("댓글 연결 글 조회 실패:", err);
      alert("연결된 글을 불러오지 못했습니다.");
    } finally {
      setOpeningCommentSightingId(null);
    }
  };

  const handleAddKeyword = async () => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;

    setKeywordLoading(true);
    try {
      const res = await api.post<KeywordSubscription>("/keywords", { keyword: trimmed });
      setKeywords((prev) => [res.data, ...prev]);
      setNewKeyword("");
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      alert(typeof detail === "string" ? detail : "키워드 등록에 실패했습니다.");
    } finally {
      setKeywordLoading(false);
    }
  };

  const handleDeleteKeyword = async (keywordId: number) => {
    try {
      await api.delete(`/keywords/${keywordId}`);
      setKeywords((prev) => prev.filter((k) => k.id !== keywordId));
    } catch (err) {
      console.error("키워드 삭제 실패:", err);
      alert("키워드 삭제에 실패했습니다.");
    }
  };

  const tabs: { key: TabType; label: string; count?: number }[] = [
    { key: "sightings", label: "내 글", count: mySightings.length },
    { key: "comments", label: "내 댓글" },
    { key: "keywords", label: "관심 키워드", count: keywords.length },
  ];

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
          </div>

          {/* 탭 네비게이션 */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? "text-blue-600 border-blue-600"
                    : "text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
                {tab.count !== undefined && (
                  <span className="ml-1.5 text-xs text-gray-400">({tab.count})</span>
                )}
              </button>
            ))}
          </div>

          {/* ===== 내 글 탭 ===== */}
          {activeTab === "sightings" && (
            <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">내가 작성한 글</h2>
                <p className="text-sm text-gray-500 mt-1">삭제한 글은 여기 표시되지 않습니다.</p>
              </div>

              <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="주소 또는 내용으로 검색"
                  className="w-full rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {isSearchPending && <p className="text-xs text-gray-400">검색 반영 중...</p>}

                <div className="flex flex-wrap gap-2">
                  {animalTypeOptions.map((option) => (
                    <button
                      key={option.value || "all"}
                      onClick={() => setFilterAnimalType(option.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filterAnimalType === option.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}

                  <div className="w-px bg-gray-200 mx-1" />

                  {(["", "SIGHTING", "LOST"] as const).map((type) => (
                    <button
                      key={type}
                      onClick={() => setFilterPostType(type)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filterPostType === type
                          ? "bg-purple-500 text-white border-purple-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-purple-400"
                      }`}
                    >
                      {type === "" ? "전체 유형" : type === "SIGHTING" ? "목격" : "실종"}
                    </button>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  {(["", "SPOTTED", "LOST", "PROTECTING", "FOUND"] as const).map((st) => (
                    <button
                      key={st}
                      onClick={() => setFilterStatus(st)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        filterStatus === st
                          ? "bg-green-500 text-white border-green-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-green-400"
                      }`}
                    >
                      {st === "" ? "전체 상태" : st === "SPOTTED" ? "목격" : st === "LOST" ? "실종" : st === "PROTECTING" ? "보호 중" : "찾음"}
                    </button>
                  ))}
                  <div className="w-px bg-gray-200 mx-1" />
                  <button
                    onClick={() => setIncludeArchived((prev) => !prev)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                      includeArchived ? "bg-gray-700 text-white border-gray-700" : "bg-white text-gray-600 border-gray-300 hover:border-gray-500"
                    }`}
                  >
                    📦 보관 포함
                  </button>
                </div>

                <p className="text-xs text-gray-400">
                  {filteredSightings.length}개 글
                  {filteredSightings.length !== mySightings.length && ` (전체 ${mySightings.length}개 중)`}
                </p>
              </div>

              {loading ? (
                <div className="px-4 py-12 text-center text-gray-500">내 글 목록을 불러오는 중입니다...</div>
              ) : mySightings.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-gray-700 font-medium">아직 등록한 글이 없습니다.</p>
                  <p className="text-sm text-gray-500 mt-2">목격 또는 실종 글을 등록해보세요.</p>
                </div>
              ) : filteredSightings.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-gray-700 font-medium">조건에 맞는 글이 없습니다.</p>
                  <p className="text-sm text-gray-500 mt-2">필터를 조정해보세요.</p>
                </div>
              ) : (
                <SightingList
                  sightings={filteredSightings}
                  selectedId={selectedSightingId}
                  onSelect={handleSelect}
                  searchQuery={deferredSearchQuery}
                />
              )}
            </section>
          )}

          {/* ===== 내 댓글 탭 ===== */}
          {activeTab === "comments" && (
            <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">내가 작성한 댓글</h2>
                <p className="text-sm text-gray-500 mt-1">댓글을 누르면 해당 글 상세를 바로 확인할 수 있습니다.</p>
              </div>

              {/* 기간 필터 */}
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex flex-wrap gap-2">
                  {PERIOD_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setCommentPeriod(option.value)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                        commentPeriod === option.value
                          ? "bg-blue-500 text-white border-blue-500"
                          : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  {myCommentsTotal}개 댓글
                  {myComments.length < myCommentsTotal && ` (${myComments.length}개 표시 중)`}
                </p>
              </div>

              {/* 댓글 목록 */}
              {myCommentsLoading && myComments.length === 0 ? (
                <div className="px-4 py-12 text-center text-gray-500">내 댓글 목록을 불러오는 중입니다...</div>
              ) : myComments.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-gray-700 font-medium">해당 기간에 작성한 댓글이 없습니다.</p>
                  <p className="text-sm text-gray-500 mt-2">관심 있는 글에 댓글을 남겨보세요.</p>
                </div>
              ) : (
                <div className="p-4 space-y-3">
                  {myComments.map((comment) => {
                    const animalInfo = animalConfig[comment.sighting_animal_type || ""] ?? {
                      emoji: "🐾",
                      color: "bg-gray-500",
                      label: "동물",
                    };
                    const postTypeInfo = postTypeConfig[comment.sighting_post_type || ""] ?? {
                      label: comment.sighting_post_type || "글",
                      emoji: "📄",
                      color: "bg-gray-100 text-gray-700",
                      bgColor: "bg-gray-500",
                    };
                    const sightingStatusInfo = statusConfig[comment.sighting_status || ""] ?? {
                      label: comment.sighting_status || "상태",
                      color: "bg-gray-100 text-gray-700",
                      bgColor: "bg-gray-500",
                    };
                    const { main } = parseAddress(comment.sighting_address);
                    const isOpening = openingCommentSightingId === comment.sighting_id;

                    return (
                      <button
                        key={comment.id}
                        type="button"
                        onClick={() => handleMyCommentClick(comment)}
                        disabled={isOpening}
                        className="w-full text-left rounded-xl border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100 active:bg-gray-200 transition-colors disabled:opacity-60"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${postTypeInfo.color}`}>
                                {postTypeInfo.emoji} {postTypeInfo.label}
                              </span>
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${sightingStatusInfo.color}`}>
                                {sightingStatusInfo.label}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-gray-900">
                              {animalInfo.label}
                              {comment.sighting_post_type === "LOST" ? " 실종 글" : " 목격 글"}
                            </p>

                            {main && (
                              <p className="text-xs text-gray-500 mt-1 truncate">📍 {main}</p>
                            )}

                            <div className="mt-3 rounded-lg bg-white border border-gray-200 p-3">
                              <p className="text-xs text-gray-400 mb-1">
                                내 댓글 · {formatDate(comment.created_at)}
                                {isEdited(comment.created_at, comment.updated_at) && (
                                  <span className="ml-1">(수정됨)</span>
                                )}
                              </p>

                              {comment.image_url && (
                                <img
                                  src={comment.image_url}
                                  alt="내 댓글 이미지"
                                  className="w-full max-h-40 object-cover rounded-lg mb-2"
                                />
                              )}

                              {comment.content ? (
                                <p className="text-sm text-gray-700 leading-relaxed line-clamp-3">
                                  {comment.content}
                                </p>
                              ) : (
                                <p className="text-sm text-gray-500">📷 이미지만 첨부한 댓글</p>
                              )}
                            </div>

                            {comment.sighting_description && (
                              <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                연결된 글: {comment.sighting_description}
                              </p>
                            )}

                            {isOpening && <p className="text-xs text-blue-500 mt-2">글을 여는 중...</p>}
                          </div>

                          {comment.sighting_image_url ? (
                            <img
                              src={comment.sighting_image_url}
                              alt="연결된 글 썸네일"
                              className="w-16 h-16 object-cover rounded-lg border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-16 h-16 rounded-lg flex items-center justify-center text-2xl text-white ${animalInfo.color} flex-shrink-0`}
                            >
                              {animalInfo.emoji}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}

                  {/* 더 보기 */}
                  {hasMoreComments && (
                    <button
                      onClick={handleLoadMoreComments}
                      disabled={myCommentsLoading}
                      className="w-full py-3 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl hover:bg-blue-100 disabled:bg-gray-100 disabled:text-gray-400 transition-colors"
                    >
                      {myCommentsLoading ? "불러오는 중..." : `더 보기 (${myCommentsTotal - myComments.length}개 남음)`}
                    </button>
                  )}
                </div>
              )}
            </section>
          )}

          {/* ===== 관심 키워드 탭 ===== */}
          {activeTab === "keywords" && (
            <section className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="px-4 py-4 border-b border-gray-100">
                <h2 className="text-lg font-semibold text-gray-900">관심 키워드</h2>
                <p className="text-sm text-gray-500 mt-1">
                  등록한 키워드와 일치하는 새 글이 올라오면 알림을 받습니다.
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  예: &quot;서울&quot; → 서울 전체, &quot;강남&quot; → 강남구 전체, &quot;검정 고양이&quot; → 특징 매칭
                </p>
              </div>

              <div className="p-4 space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={(e) => setNewKeyword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddKeyword();
                      }
                    }}
                    placeholder="키워드 입력 (예: 강남, 검정 고양이)"
                    className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                  <button
                    onClick={handleAddKeyword}
                    disabled={keywordLoading || !newKeyword.trim()}
                    className="px-4 py-2.5 rounded-xl bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 disabled:bg-gray-300 disabled:text-gray-500 transition-colors flex-shrink-0"
                  >
                    {keywordLoading ? "등록 중..." : "등록"}
                  </button>
                </div>

                {keywords.length === 0 ? (
                  <div className="text-sm text-gray-400 text-center py-6">등록된 키워드가 없습니다.</div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {keywords.map((kw) => (
                      <div
                        key={kw.id}
                        className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5"
                      >
                        <span className="text-sm text-blue-700">{kw.keyword}</span>
                        <button
                          onClick={() => handleDeleteKeyword(kw.id)}
                          className="w-4 h-4 rounded-full bg-blue-200 text-blue-600 flex items-center justify-center hover:bg-blue-300 transition-colors text-xs leading-none"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-xs text-gray-400">최대 20개까지 등록할 수 있습니다. ({keywords.length}/20)</p>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}