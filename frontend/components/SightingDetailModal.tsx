import type { Sighting } from "@/types/sighting";
import { animalConfig, formatDate, parseAddress } from "@/lib/sightingUtils";

interface SightingDetailModalProps {
  sighting: Sighting;
  onClose: () => void;
  onImageClick: (imageUrl: string) => void;
}

export default function SightingDetailModal({
  sighting,
  onClose,
  onImageClick,
}: SightingDetailModalProps) {
  const { main, detail } = parseAddress(sighting.address);

  const statusLabels: Record<string, { label: string; color: string }> = {
    SPOTTED: { label: "목격됨", color: "bg-yellow-100 text-yellow-700" },
    PROTECTING: { label: "보호 중", color: "bg-blue-100 text-blue-700" },
    SHELTERED: { label: "보호소 입소", color: "bg-purple-100 text-purple-700" },
    ADOPTED: { label: "입양 완료", color: "bg-green-100 text-green-700" },
  };

  const statusInfo = statusLabels[sighting.status] || {
    label: sighting.status,
    color: "bg-gray-100 text-gray-700",
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
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg ${
                  animalConfig[sighting.animal_type]?.color || "bg-gray-500"
                }`}
              >
                {animalConfig[sighting.animal_type]?.emoji || "🐾"}
              </div>
              <div>
                <p className="font-semibold text-gray-900">
                  {animalConfig[sighting.animal_type]?.label || "동물"} 발견
                </p>
                <p className="text-xs text-gray-400">
                  {formatDate(sighting.created_at)}
                </p>
              </div>
            </div>

            <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusInfo.color}`}>
              {statusInfo.label}
            </span>
          </div>

          {(main || detail) && (
            <div className="bg-gray-50 rounded-xl p-3">
              {main && <p className="text-sm text-gray-700">📍 {main}</p>}
              {detail && <p className="text-xs text-gray-500 mt-1">└ {detail}</p>}
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">설명</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {sighting.description || "등록된 설명이 없습니다."}
            </p>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <p className="text-xs text-gray-400">신고 번호: #{sighting.id}</p>
            {sighting.user_nickname && (
              <p className="text-xs text-gray-500">작성자: {sighting.user_nickname}</p>
            )}
          </div>

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