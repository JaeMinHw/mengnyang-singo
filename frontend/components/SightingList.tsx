import type { Sighting } from "@/types/sighting";
import {
  animalConfig,
  statusConfig,
  postTypeConfig,
  formatDate,
  parseAddress,
  getHighlightParts,
} from "@/lib/sightingUtils";

interface SightingListProps {
  sightings: Sighting[];
  selectedId: number | null;
  onSelect: (sighting: Sighting) => void;
  searchQuery: string;
}

export default function SightingList({
  sightings,
  selectedId,
  onSelect,
  searchQuery,
}: SightingListProps) {
  const renderHighlightedText = (text: string, keyPrefix: string) => {
    const parts = getHighlightParts(text, searchQuery);

    return parts.map((part, index) =>
      part.matched ? (
        <mark
          key={`${keyPrefix}-${index}`}
          className="bg-yellow-200 text-gray-900 rounded px-0.5"
        >
          {part.text}
        </mark>
      ) : (
        <span key={`${keyPrefix}-${index}`}>{part.text}</span>
      )
    );
  };

  return (
    <ul className="divide-y divide-gray-100">
      {sightings.map((sighting) => {
        const typeConf = postTypeConfig[sighting.post_type] || postTypeConfig["SIGHTING"];

        return (
          <li
            key={sighting.id}
            onClick={() => onSelect(sighting)}
            className={`p-4 cursor-pointer transition hover:bg-gray-50 ${
              selectedId === sighting.id ? "bg-orange-50" : ""
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-lg flex-shrink-0 ${
                  animalConfig[sighting.animal_type]?.color || "bg-gray-500"
                }`}
              >
                {animalConfig[sighting.animal_type]?.emoji || "🐾"}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${typeConf.color}`}>
                    {typeConf.emoji} {typeConf.label}
                  </span>

                  <span className="font-medium text-gray-900">
                    {animalConfig[sighting.animal_type]?.label || "동물"}
                    {sighting.post_type === "LOST" ? " 실종" : " 발견"}
                  </span>

                  <span
                    className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                      statusConfig[sighting.status]?.color || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {statusConfig[sighting.status]?.label || sighting.status}
                  </span>
                </div>

                {sighting.image_url && (
                  <img
                    src={sighting.image_url}
                    alt="신고 썸네일"
                    className="w-full h-24 object-cover rounded-xl border border-gray-200 mt-2"
                  />
                )}

                {sighting.address &&
                  (() => {
                    const { main, detail } = parseAddress(sighting.address);
                    return (
                      <>
                        {main && (
                          <p className="text-sm text-gray-600 truncate mt-2">
                            📍 {renderHighlightedText(main, `${sighting.id}-address-main`)}
                          </p>
                        )}
                        {detail && (
                          <p className="text-xs text-gray-400 truncate">
                            └ {renderHighlightedText(detail, `${sighting.id}-address-detail`)}
                          </p>
                        )}
                      </>
                    );
                  })()}

                {sighting.description && (
                  <p className="text-sm text-gray-500 truncate mt-1">
                    {renderHighlightedText(
                      sighting.description,
                      `${sighting.id}-description`
                    )}
                  </p>
                )}

                <p className="text-xs text-gray-400 mt-1">
                  {formatDate(sighting.created_at)}
                  {sighting.user_nickname && ` · ${sighting.user_nickname}`}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}