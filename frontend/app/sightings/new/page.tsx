"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import exifr from "exifr";

import Script from "next/script";
import { Map as KakaoMap, MapMarker } from "react-kakao-maps-sdk";
import { useRouter } from "next/navigation";
import Link from "next/link";
import api from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

// 두 좌표 사이 거리 계산 (미터 단위, Haversine 공식)
function getDistanceInMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371000; // 지구 반지름 (미터)
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}


export default function NewSightingPage() {
  const router = useRouter();
  const [exifInfo, setExifInfo] = useState<string>("");

  const [animalType, setAnimalType] = useState("CAT");
  const [description, setDescription] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [address, setAddress] = useState("");
  const [locationDetail, setLocationDetail] = useState("");

  const [hasChosenLocation, setHasChosenLocation] = useState(false);

  const [loading, setLoading] = useState(false);
  const [locationLoading, setLocationLoading] = useState(false);
  const [mapLoading, setMapLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mapRef = useRef<kakao.maps.Map | null>(null);


  const updatePositionFromMapCenter = (map: kakao.maps.Map) => {
    const center = map.getCenter();
    const lat = center.getLat();
    const lng = center.getLng();

    setLatitude(lat.toString());
    setLongitude(lng.toString());
    reverseGeocode(lat, lng);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);

    try {
      const exifData = await exifr.gps(file);

      if (exifData && exifData.latitude && exifData.longitude) {
        const exifLat = exifData.latitude;
        const exifLng = exifData.longitude;

        const userLat = parseFloat(latitude);
        const userLng = parseFloat(longitude);

        const hasValidUserPosition =
          hasChosenLocation &&
          !Number.isNaN(userLat) &&
          !Number.isNaN(userLng);

        // 사용자가 아직 신뢰 가능한 위치를 고르지 못했다면 EXIF 좌표를 바로 적용
        if (!hasValidUserPosition) {
          applyPosition(exifLat, exifLng);
          setErrorMessage("");
          setExifInfo(
            `📸 EXIF GPS 발견: ${exifLat}, ${exifLng} · 현재 선택된 위치가 없어 사진 촬영 위치를 사용했습니다.`
          );
          return;
        }

        // 사용자 위치가 있으면 거리 비교
        const distance = getDistanceInMeters(userLat, userLng, exifLat, exifLng);

        // 차이가 작으면 사용자 좌표 유지
        if (distance <= 500) {
          setExifInfo(
            `📸 EXIF GPS 발견: ${exifLat}, ${exifLng} (거리: ${Math.round(distance)}m) · 현재 선택한 위치를 유지합니다.`
          );
          return;
        }

        // 차이가 크면 사용자에게 선택권 제공
        const useExif = window.confirm(
          `사진이 촬영된 위치가 현재 선택한 위치와 약 ${Math.round(distance)}m 떨어져 있습니다.\n\n사진 촬영 위치로 변경하시겠습니까?`
        );

        if (useExif) {
          applyPosition(exifLat, exifLng);
          setExifInfo(
            `📸 EXIF GPS 발견: ${exifLat}, ${exifLng} (거리: ${Math.round(distance)}m) · 사진 촬영 위치를 적용했습니다.`
          );
        } else {
          setExifInfo(
            `📸 EXIF GPS 발견: ${exifLat}, ${exifLng} (거리: ${Math.round(distance)}m) · 현재 선택한 위치를 유지합니다.`
          );
        }
      } else {
        setExifInfo("📸 EXIF GPS 정보 없음");
      }
    } catch (err) {
      console.log("📸 EXIF 읽기 실패 (무시 가능):", err);
      setExifInfo("📸 EXIF 읽기 실패 (무시 가능)");
    }
  };

  const handleImageRemove = () => {
    setImageFile(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services&autoload=false`;

  // 좌표 → 주소 변환 (역지오코딩)
  const reverseGeocode = useCallback((lat: number, lng: number) => {
    if (!window.kakao || !window.kakao.maps || !window.kakao.maps.services) return;

    const geocoder = new window.kakao.maps.services.Geocoder();

    geocoder.coord2Address(lng, lat, (result: any, status: any) => {
      if (status === window.kakao.maps.services.Status.OK && result[0]) {
        const addr = result[0].road_address
          ? result[0].road_address.address_name
          : result[0].address.address_name;
        setAddress(addr);
      }
    });
  }, []);

  const applyPosition = useCallback(
  (lat: number, lng: number) => {
    setLatitude(lat.toString());
    setLongitude(lng.toString());
    reverseGeocode(lat, lng);
    setHasChosenLocation(true);

    if (mapRef.current) {
      const target = new window.kakao.maps.LatLng(lat, lng);
      mapRef.current.setCenter(target);
    }
  },
  [reverseGeocode]
);

  // 현재 위치 가져오기
  const handleUseCurrentLocation = () => {
    setErrorMessage("");

    if (!navigator.geolocation) {
      setErrorMessage("이 브라우저에서는 위치 정보를 지원하지 않습니다.");
      return;
    }

    setLocationLoading(true);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        applyPosition(lat, lng);
        setLocationLoading(false);
      },
      (error) => {
        console.error("현재 위치 가져오기 실패:", error);

        switch (error.code) {
          case error.PERMISSION_DENIED:
            setErrorMessage("위치 정보 접근이 거부되었습니다. 브라우저 권한을 확인해주세요.");
            break;
          case error.POSITION_UNAVAILABLE:
            setErrorMessage("현재 위치 정보를 가져올 수 없습니다.");
            break;
          case error.TIMEOUT:
            setErrorMessage("위치 정보를 가져오는 데 시간이 너무 오래 걸립니다.");
            break;
          default:
            setErrorMessage("현재 위치를 가져오지 못했습니다.");
        }

        setLocationLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // 페이지 열릴 때 자동으로 현재 위치 가져오기
  useEffect(() => {
    handleUseCurrentLocation();
  }, []);

  // 카카오 SDK 로드 처리
  const handleScriptLoad = () => {
    window.kakao.maps.load(() => {
      setMapLoading(false);
    });
  };

  useEffect(() => {
    if (window.kakao && window.kakao.maps) {
      setMapLoading(false);
    }
  }, []);

  // 지도 클릭 시 좌표 변경 + 주소 변환
  const handleMapClick = (_: any, mouseEvent: any) => {
    const latlng = mouseEvent.latLng;
    const lat = latlng.getLat();
    const lng = latlng.getLng();

    setLatitude(lat.toString());
    setLongitude(lng.toString());
    reverseGeocode(lat, lng);
  };
  const uploadImage = async (): Promise<string | null> => {
    if (!imageFile) return null;

    const formData = new FormData();
    formData.append("file", imageFile);

    const response = await api.post<{ image_url: string }>(
      "/upload/image",
      formData,
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return response.data.image_url;
  };
  // 신고 등록
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    const token = getAccessToken();
    if (!token) {
      setErrorMessage("로그인이 필요합니다.");
      setLoading(false);
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng)) {
      setErrorMessage("지도에서 위치를 선택해주세요.");
      setLoading(false);
      return;
    }

    // 주소 + 상세위치 합치기
    const fullAddress = locationDetail
      ? `${address}|||${locationDetail}`
      : address;

    try {
      // 1. 이미지가 있으면 먼저 업로드
      const uploadedImageUrl = await uploadImage();

      // 2. 신고 등록
      await api.post("/sightings", {
        animal_type: animalType,
        description: description || null,
        image_url: uploadedImageUrl,
        latitude: lat,
        longitude: lng,
        address: fullAddress || null,
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

  // 지도 중심 계산
  const parsedLat = parseFloat(latitude);
  const parsedLng = parseFloat(longitude);

  const mapCenter =
    !isNaN(parsedLat) && !isNaN(parsedLng)
      ? { lat: parsedLat, lng: parsedLng }
      : { lat: 37.5665, lng: 126.9780 };

  return (
    <>
      <Script src={KAKAO_SDK_URL} strategy="afterInteractive" onLoad={handleScriptLoad} />

      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
          >
            ← 돌아가기
          </Link>

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

                        {/* 사진 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                사진 <span className="text-gray-400">(선택)</span>
              </label>
              {exifInfo && (
                <p className="text-xs text-blue-500 mt-1">{exifInfo}</p>
              )}

              {imagePreview ? (
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="미리보기"
                    className="w-full h-48 object-cover rounded-xl border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={handleImageRemove}
                    className="absolute top-2 right-2 w-7 h-7 bg-black/60 text-white rounded-full flex items-center justify-center hover:bg-black/80 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full h-32 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-gray-500 hover:bg-gray-100 hover:border-gray-400 transition-colors"
                >
                  <span className="text-2xl mb-1">📷</span>
                  <span className="text-sm">사진을 선택해주세요</span>
                </button>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* 현재 위치 버튼 */}
            <div>
              <button
                type="button"
                onClick={handleUseCurrentLocation}
                disabled={locationLoading}
                className="w-full rounded-xl bg-blue-50 border border-blue-200 py-3 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:bg-blue-50 disabled:text-blue-300 transition-colors"
              >
                {locationLoading ? "현재 위치 확인 중..." : "📍 현재 위치로 재설정"}
              </button>
            </div>

            {/* 작은 지도 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                위치 선택
              </label>

              <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-100 relative">
                {mapLoading ? (
                  <div className="h-64 flex items-center justify-center text-sm text-gray-500">
                    지도 로딩 중...
                  </div>
                ) : (
                  <>
                    <KakaoMap
                      center={mapCenter}
                      level={3}
                      style={{ width: "100%", height: "256px" }}
                      onCreate={(map) => {
                        mapRef.current = map;
                      }}
                      onDragEnd={() => {
                        setHasChosenLocation(true);
                      }}
                      onIdle={(map) => {
                        updatePositionFromMapCenter(map);
                      }}
                    />

                    {/* 화면 중앙 고정 핀 */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div className="flex flex-col items-center">
                        <span className="text-3xl drop-shadow-lg">📍</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <p className="mt-2 text-xs text-gray-500">
                지도를 클릭하거나 움직여서 위치를 선택할 수 있습니다.
              </p>
            </div>

            {/* 주소 (자동) */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                주소
              </label>
              <div className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-800">
                {address || "지도에서 위치를 선택하면 자동으로 표시됩니다."}
              </div>
            </div>

            {/* 상세 위치 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                상세 위치 <span className="text-gray-400">(선택)</span>
              </label>
              <input
                type="text"
                value={locationDetail}
                onChange={(e) => setLocationDetail(e.target.value)}
                placeholder="예: 자판기 옆 벤치, 아파트 정문 앞"
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
    </>
  );
}