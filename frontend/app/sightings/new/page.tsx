"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

export default function NewSightingPage() {
  const router = useRouter();

  const [animalType, setAnimalType] = useState("CAT");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    // 로그인 체크
    const token = getAccessToken();
    if (!token) {
      setErrorMessage("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    // 위도/경도 숫자 검증
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage("위도와 경도는 숫자로 입력해주세요.");
      setLoading(false);
      return;
    }

    try {
      await api.post("/sightings", {
        animal_type: animalType,
        description: description || null,
        image_url: null,
        latitude: lat,
        longitude: lng,
        address: address || null,
      });

      alert("신고가 등록되었습니다.");
      router.push("/");
    } catch (error: any) {
      console.error("신고 등록 실패:", error);

      if (error?.response?.status === 401) {
        setErrorMessage("로그인이 만료되었습니다. 다시 로그인해주세요.");
      } else {
        const detail = error?.response?.data?.detail;
        setErrorMessage(
          typeof detail === "string" ? detail : "신고 등록에 실패했습니다."
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">신고 등록</h1>
        <p className="text-sm text-gray-500 mb-6">
          발견한 동물의 정보를 입력해주세요.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 동물 종류 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              동물 종류
            </label>
            <div className="flex gap-2">
              {[
                { value: "CAT", emoji: "🐱", label: "고양이" },
                { value: "DOG", emoji: "🐶", label: "강아지" },
                { value: "OTHER", emoji: "🐾", label: "기타" },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setAnimalType(option.value)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition ${
                    animalType === option.value
                      ? "bg-orange-500 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {option.emoji} {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              설명
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="동물의 특징, 상태 등을 입력해주세요"
              rows={3}
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 resize-none"
            />
          </div>

          {/* 위도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              위도
            </label>
            <input
              type="text"
              value={latitude}
              onChange={(e) => setLatitude(e.target.value)}
              placeholder="예: 37.5665"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          {/* 경도 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              경도
            </label>
            <input
              type="text"
              value={longitude}
              onChange={(e) => setLongitude(e.target.value)}
              placeholder="예: 126.9780"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              required
            />
          </div>

          {/* 주소 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              주소
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="예: 서울특별시 중구 세종대로 110"
              className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-black outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {/* 에러 메시지 */}
          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
              {errorMessage}
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex gap-3 pt-2">
            <Link
              href="/"
              className="flex-1 text-center rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-3 transition-colors"
            >
              {loading ? "등록 중..." : "신고 등록"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}