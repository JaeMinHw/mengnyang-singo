import type { Sighting } from "@/types/sighting";
import SightingList from "@/components/SightingList";

interface SightingListPanelProps {
  sightings: Sighting[];
  selectedId: number | null;
  onSelect: (sighting: Sighting) => void;
  isExpanded: boolean;
  onToggle: () => void;
}

export default function SightingListPanel({
  sightings,
  selectedId,
  onSelect,
  isExpanded,
  onToggle,
}: SightingListPanelProps) {
  return (
    <>
      {/* ===== PC: 오른쪽 사이드 패널 ===== */}
      <div className="hidden lg:flex w-96 bg-white border-l border-gray-200 flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <h2 className="font-semibold text-lg text-gray-900">
            신고 목록 ({sightings.length})
          </h2>
        </div>

        <div className="flex-1 overflow-y-auto">
          {sightings.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p className="text-4xl mb-4">🔍</p>
              <p>이 지역에 신고가 없습니다</p>
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
          ${isExpanded ? "h-[65dvh]" : "h-[12dvh]"}
        `}
      >
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

        <div className="flex-1 overflow-y-auto border-t border-gray-100">
          {sightings.length === 0 ? (
            <div className="p-5 text-center text-gray-500">
              <p className="text-3xl mb-4">🔍</p>
              <p>이 지역에 신고가 없습니다</p>
            </div>
          ) : (
            <SightingList sightings={sightings} selectedId={selectedId} onSelect={onSelect} />
          )}
        </div>
      </div>
    </>
  );
}