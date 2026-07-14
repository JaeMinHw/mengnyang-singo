"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Map as KakaoMap,
  MapMarker,
  Polyline,
  useKakaoLoader,
} from "react-kakao-maps-sdk";

import api from "@/lib/api";
import Header from "@/components/Header";
import { getAccessToken } from "@/lib/auth";

import type {
  CasePreviewResponse,
  CasePreviewItem,
  CurrentUser,
} from "@/types/sighting";

import {
  animalConfig,
  postTypeConfig,
  statusConfig,
  parseAddress,
  formatDate,
  formatDistance,
} from "@/lib/sightingUtils";

function formatTimeDiffLabel(minutes: number) {
  if (minutes <= 0) return "기준 글";

  if (minutes < 60) {
    return `${Math.round(minutes)}분 차이`;
  }

  const hours = minutes / 60;
  if (hours < 24) {
    return `${hours.toFixed(1)}시간 차이`;
  }

  const days = hours / 24;
  return `${days.toFixed(1)}일 차이`;
}

function formatSpeedLabel(speed: number | null) {
  if (speed === null) return "-";
  return `${speed.toFixed(1)}km/h`;
}

export default function CasePreviewPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const sightingId = searchParams.get("sightingId");

    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [authLoading, setAuthLoading] = useState(true);

    const [mapLoading, mapError] = useKakaoLoader({
    appkey: process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY ?? "",
    });
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<CasePreviewResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
    const token = getAccessToken();

    if (!token) {
        setCurrentUser(null);
        setAuthLoading(false);
        return;
    }

    api
        .get<CurrentUser>("/me")
        .then((res) => setCurrentUser(res.data))
        .catch(() => setCurrentUser(null))
        .finally(() => setAuthLoading(false));
    }, []);

  

  useEffect(() => {
    if (!sightingId) {
      setError("기준 글 정보가 없습니다.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    api
      .get<CasePreviewResponse>(`/sightings/${sightingId}/case-preview`)
      .then((res) => {
        setData(res.data);
      })
      .catch((err) => {
        console.error("이동 경로 미리보기 조회 실패:", err);
        setError("이동 경로 미리보기를 불러오지 못했습니다.");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [sightingId]);

  const items = data?.items ?? [];

  const baseItem = useMemo<CasePreviewItem | null>(() => {
    return items.find((item) => item.is_base) ?? items[0] ?? null;
  }, [items]);

  const polylinePath = useMemo(() => {
    return items.map((item) => ({
      lat: item.sighting.latitude,
      lng: item.sighting.longitude,
    }));
  }, [items]);

  return (
    <main className="min-h-[100dvh] bg-gray-50">
      <Header currentUser={currentUser} authLoading={authLoading} />

      <div className="max-w-4xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">이동 경로 미리보기</h1>
            <p className="text-sm text-gray-500 mt-1">
              같은 동물로 추정되는 글 흐름을 시간순으로 살펴봅니다.
            </p>
          </div>

          <button
            onClick={() => router.back()}
            className="px-4 py-2 rounded-xl border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            ← 돌아가기
          </button>
        </div>

        <section className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="px-4 py-14 text-center text-gray-500">
              이동 경로를 불러오는 중입니다...
            </div>
          ) : error ? (
            <div className="px-4 py-14 text-center">
              <p className="text-gray-700 font-medium">{error}</p>
              <p className="text-sm text-gray-500 mt-2">
                다시 시도하거나 기준 글을 확인해주세요.
              </p>
            </div>
          ) : !baseItem || items.length === 0 ? (
            <div className="px-4 py-14 text-center">
              <p className="text-gray-700 font-medium">
                표시할 이동 경로 정보가 없습니다.
              </p>
            </div>
          ) : (
            <>
              <div className="px-4 py-4 border-b border-gray-100">
                <p className="text-sm font-semibold text-gray-900">
                  기준 글 #{baseItem.sighting.id}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  이 화면은 확정된 동일 개체 판정이 아니라, 관련 가능성이 있는
                  흐름을 미리 보는 용도입니다.
                </p>
              </div>

              <div className="p-4 space-y-4">
                {mapLoading ? (
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-12 text-center text-gray-400">
                        지도를 불러오는 중입니다...
                    </div>
                    ) : mapError ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-12 text-center text-red-500">
                        카카오 지도를 불러오지 못했습니다.
                    </div>
                    ) : (
                    <div className="rounded-2xl overflow-hidden border border-gray-200">
                        <KakaoMap
                        center={{
                            lat: baseItem.sighting.latitude,
                            lng: baseItem.sighting.longitude,
                        }}
                        level={5}
                        style={{ width: "100%", height: "360px" }}
                        >
                        {polylinePath.length >= 2 && (
                            <Polyline
                            path={polylinePath}
                            strokeWeight={4}
                            strokeColor="#3B82F6"
                            strokeOpacity={0.8}
                            strokeStyle="solid"
                            />
                        )}

                        {items.map((item, index) => {
                            const title = item.is_base
                            ? `기준 글 #${item.sighting.id}`
                            : `${index + 1}. 글 #${item.sighting.id}`;

                            return (
                            <MapMarker
                                key={item.sighting.id}
                                position={{
                                lat: item.sighting.latitude,
                                lng: item.sighting.longitude,
                                }}
                                title={title}
                            />
                            );
                        })}
                        </KakaoMap>
                    </div>
                    )}

                <div className="rounded-2xl bg-blue-50 border border-blue-100 p-4">
                  <p className="text-sm font-semibold text-blue-900">
                    해석 안내
                  </p>
                  <ul className="mt-2 space-y-1 text-sm text-blue-800 list-disc pl-5">
                    <li>시간순으로 정렬된 흐름입니다.</li>
                    <li>
                      너무 짧은 시간 안에 비현실적으로 멀리 이동한 후보는
                      제외됩니다.
                    </li>
                    <li>
                      특징 키워드는 같은 동물일 가능성을 보조하는 참고 정보입니다.
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => {
                    const sighting = item.sighting;
                    const animalInfo =
                      animalConfig[sighting.animal_type] ?? {
                        emoji: "🐾",
                        color: "bg-gray-500",
                        label: "동물",
                      };

                    const postTypeInfo =
                      postTypeConfig[sighting.post_type] ?? {
                        label: sighting.post_type,
                        emoji: "📄",
                        color: "bg-gray-100 text-gray-700",
                        bgColor: "bg-gray-500",
                      };

                    const statusInfo =
                      statusConfig[sighting.status] ?? {
                        label: sighting.status,
                        color: "bg-gray-100 text-gray-700",
                        bgColor: "bg-gray-500",
                      };

                    const { main, detail } = parseAddress(sighting.address);

                    return (
                      <div
                        key={`${sighting.id}-${index}`}
                        className={`rounded-2xl border p-4 ${
                          item.is_base
                            ? "border-blue-300 bg-blue-50"
                            : "border-gray-200 bg-gray-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              {item.is_base && (
                                <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-600 text-white font-medium">
                                  기준 글
                                </span>
                              )}

                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${postTypeInfo.color}`}
                              >
                                {postTypeInfo.emoji} {postTypeInfo.label}
                              </span>

                              <span
                                className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusInfo.color}`}
                              >
                                {statusInfo.label}
                              </span>
                            </div>

                            <p className="text-sm font-semibold text-gray-900">
                              {animalInfo.emoji} {animalInfo.label} #{sighting.id}
                            </p>

                            <p className="text-xs text-gray-400 mt-1">
                              {formatDate(sighting.created_at)}
                            </p>

                            {main && (
                              <p className="text-sm text-gray-700 mt-2">
                                📍 {main}
                              </p>
                            )}

                            {detail && (
                              <p className="text-xs text-gray-500 mt-1">
                                └ {detail}
                              </p>
                            )}

                            {sighting.description && (
                              <p className="text-sm text-gray-600 mt-3 leading-relaxed">
                                {sighting.description}
                              </p>
                            )}

                            <div className="flex flex-wrap gap-2 mt-3 text-xs text-gray-500">
                              {!item.is_base && (
                                <>
                                  <span className="px-2 py-1 rounded-full bg-white border border-gray-200">
                                    거리 {formatDistance(item.distance_meters)}
                                  </span>
                                  <span className="px-2 py-1 rounded-full bg-white border border-gray-200">
                                    {formatTimeDiffLabel(item.time_diff_minutes)}
                                  </span>
                                  <span className="px-2 py-1 rounded-full bg-white border border-gray-200">
                                    추정 속도 {formatSpeedLabel(item.estimated_speed_kmh)}
                                  </span>
                                </>
                              )}
                            </div>

                            {item.matched_features.length > 0 && (
                              <div className="flex flex-wrap gap-1.5 mt-3">
                                {item.matched_features.map((feature) => (
                                  <span
                                    key={`${sighting.id}-${feature}`}
                                    className="text-[11px] px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700"
                                  >
                                    #{feature}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          {sighting.image_url ? (
                            <img
                              src={sighting.image_url}
                              alt="글 썸네일"
                              className="w-16 h-16 object-cover rounded-xl border border-gray-200 flex-shrink-0"
                            />
                          ) : (
                            <div
                              className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl text-white ${animalInfo.color} flex-shrink-0`}
                            >
                              {animalInfo.emoji}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}