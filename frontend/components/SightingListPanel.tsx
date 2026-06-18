import type { Sighting } from "@/types/sighting";
import { statusConfig } from "@/lib/sightingUtils";
import SightingList from "@/components/SightingList";

interface SightingListPanelProps {
  sightings: Sighting[];
  selectedId: number | null;
  onSelect: (sighting: Sighting) => void;
  isExpanded: boolean;
  onToggle: () => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  showFound: boolean;
  onToggleShowFound: () => void;
}

export default function SightingListPanel({
  sightings,
  selectedId,
  onSelect,
  isExpanded,
  onToggle,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  showFound,
  onToggleShowFound,
}: SightingListPanelProps) {
  return (
    <>
      {/* ===== PC: 오른쪽 사이드 패널 ===== */}
      <div className="hidden lg:flex w-96 bg-white border-l border-gray-200 flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50 space-y-3">
          <h2 className="font-semibold text-lg text-gray-900">
            신고 목록 ({sightings.length})
          </h2>

          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="검색 (예: 검정 고양이, 흰색 강아지)"
              className="w-full px-3 py-2 pr-8 text-sm text-black placeholder:text-gray-400 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 text-white text-xs transition-colors"
              >
                ✕
              </button>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => onStatusFilterChange("all")}
                className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                  statusFilter === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                전체 상태
              </button>

              {(["SPOTTED", "PROTECTING", "FOUND"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusFilterChange(status)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                    statusFilter === status
                      ? `${statusConfig[status].bgColor} text-white`
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {statusConfig[status].label}
                </button>
              ))}
            </div>

            <button
              onClick={onToggleShowFound}
              className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                showFound
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {showFound ? "찾음 포함 보는 중" : "찾음 포함 보기"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sightings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-4xl mb-4">🔍</p>
              <p className="font-medium text-gray-700">
                현재 지도 범위와 조건에 맞는 신고가 없습니다
              </p>
              <p className="mt-2 text-sm text-gray-400">
                검색어·상태 필터를 바꾸거나 지도를 이동해보세요
              </p>
            </div>
          ) : (
            <SightingList sightings={sightings} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      </div>

      {/* ===== 모바일: 바텀시트 ===== */}
      <div
        className={`
          lg:hidden fixed bottom-0 left-0 right-0 z-[900]
          bg-white rounded-t-2xl shadow-[0_-4px_20px_rgba(0,0,0,0.1)]
          flex flex-col
          transition-all duration-300 ease-in-out
          ${isExpanded ? "h-[65dvh]" : "h-[24dvh] min-h-[190px]"}
        `}
      >
        <div>
          <div className="cursor-pointer select-none" onClick={onToggle}>
            <div className="flex justify-center pt-2 pb-1">
              <div className="w-10 h-1.5 rounded-full bg-gray-300" />
            </div>

            <div className="px-4 py-2 flex items-center justify-between">
              <h2 className="font-semibold text-base text-gray-900">
                신고 목록 ({sightings.length})
              </h2>
              <span className="text-gray-400 text-xs">
                {isExpanded ? "▼ 접기" : "▲ 펼치기"}
              </span>
            </div>
          </div>

          <div className="px-4 pb-3 space-y-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="검색 (예: 검정 고양이)"
                className="w-full block px-3 py-2 pr-8 text-base text-black placeholder:text-gray-400 border border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-colors"
                onClick={(e) => e.stopPropagation()}
              />
              {searchQuery && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSearchChange("");
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-300 hover:bg-gray-400 text-white text-xs transition-colors"
                >
                  ✕
                </button>
              )}
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                onClick={() => onStatusFilterChange("all")}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                  statusFilter === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                전체 상태
              </button>

              {(["SPOTTED", "PROTECTING", "FOUND"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => onStatusFilterChange(status)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                    statusFilter === status
                      ? `${statusConfig[status].bgColor} text-white`
                      : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
                  }`}
                >
                  {statusConfig[status].label}
                </button>
              ))}
            </div>

            <button
              onClick={onToggleShowFound}
              className={`px-3 py-1.5 rounded-full text-sm font-medium shadow-sm transition ${
                showFound
                  ? "bg-emerald-600 text-white"
                  : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-100"
              }`}
            >
              {showFound ? "찾음 포함 보는 중" : "찾음 포함 보기"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-gray-100">
          {sightings.length === 0 ? (
            <div className="p-5 text-center text-gray-500">
              <p className="text-3xl mb-4">🔍</p>
              <p className="font-medium text-gray-700">
                현재 지도 범위와 조건에 맞는 신고가 없습니다
              </p>
              <p className="mt-2 text-sm text-gray-400">
                검색어·상태 필터를 바꾸거나 지도를 이동해보세요
              </p>
            </div>
          ) : (
            <SightingList sightings={sightings} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      </div>
    </>
  );
}