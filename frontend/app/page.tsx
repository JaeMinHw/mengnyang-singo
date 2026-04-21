"use client";

import { Map as KakaoMap, MapMarker, MarkerClusterer, CustomOverlayMap, useMap } from "react-kakao-maps-sdk";
import Script from "next/script";
import { useEffect, useState, useRef } from "react";
import api from "@/lib/api";

interface Sighting {
  id: number;
  animal_type: string;
  description: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
}

interface ClusterInfo {
  center: { lat: number; lng: number; };
  markers: Sighting[];
}

// 날짜 포맷팅 헬퍼 함수
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getFullYear().toString().slice(2)}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
};

function MapWithLogic() {
  const map = useMap();
  const [sightings, setSightings] = useState<Sighting[]>([]);
  const [selectedMarker, setSelectedMarker] = useState<Sighting | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<ClusterInfo | null>(null);

  const markerRef = useRef(new Map<kakao.maps.Marker, number>());

  useEffect(() => {
    api.get<Sighting[]>("/sightings")
      .then(response => setSightings(response.data))
      .catch(err => console.error("데이터 요청 실패:", err));
  }, []);

  const handleMapClick = () => {
    setSelectedMarker(null);
    setSelectedCluster(null);
  };

  useEffect(() => {
    if (!map) return;
    kakao.maps.event.addListener(map, 'click', handleMapClick);
    return () => {
      kakao.maps.event.removeListener(map, 'click', handleMapClick);
    };
  }, [map]);

  const handleClusterClick = (_target: kakao.maps.MarkerClusterer, cluster: kakao.maps.Cluster) => {
    const clusterMarkers = cluster.getMarkers();
    
    const clusterSightings = clusterMarkers
      .map(marker => markerRef.current.get(marker as kakao.maps.Marker))
      .filter((id): id is number => id !== undefined)
      .map(id => sightings.find(s => s.id === id))
      .filter((s): s is Sighting => s !== undefined);

    if (clusterSightings.length > 0) {
      setSelectedCluster({
        center: { lat: cluster.getCenter().getLat(), lng: cluster.getCenter().getLng() },
        markers: clusterSightings,
      });
      setSelectedMarker(null);
    }
  };

  const handleListItemClick = (sighting: Sighting) => {
    if (!map) return;
    
    const targetPosition = new kakao.maps.LatLng(
      Number(sighting.latitude), 
      Number(sighting.longitude)
    );
    
    map.setLevel(3); 
    map.setCenter(targetPosition); 
    
    setSelectedCluster(null);
    setSelectedMarker(sighting);
  };

  return (
    <>
      <MarkerClusterer
        averageCenter={true}
        minLevel={6}
        gridSize={60}
        disableClickZoom={true} 
        onClusterclick={handleClusterClick}
      >
        {sightings.map((sighting) => (
          <MapMarker
            key={sighting.id}
            position={{ lat: sighting.latitude, lng: sighting.longitude }}
            onCreate={(marker) => markerRef.current.set(marker, sighting.id)}
            onClick={(marker) => {
              map.setLevel(3); 
              map.setCenter(marker.getPosition()); 
              
              setSelectedMarker(sighting);
              setSelectedCluster(null);
            }}
            image={{
              src: sighting.animal_type === "DOG" ? "/dog-marker.png" : "/cat-marker.png",
              size: { width: 36, height: 36 },
            }}
          />
        ))}
      </MarkerClusterer>

      {/* 🎨 단일 마커 정보창 (말풍선 스타일) */}
      {selectedMarker && (
        <CustomOverlayMap 
          position={{ lat: selectedMarker.latitude, lng: selectedMarker.longitude }} 
          yAnchor={1.3} 
          clickable={true} 
        >
          <div className="relative flex flex-col items-center drop-shadow-xl">
            {/* 정보창 본체 */}
            <div className="p-4 bg-white rounded-2xl border border-gray-100 min-w-[200px] z-10">
              <div className="flex justify-between items-start mb-2">
                <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${selectedMarker.animal_type === "DOG" ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"}`}>
                  {selectedMarker.animal_type === "DOG" ? "🐶 강아지" : "🐱 고양이"}
                </span>
                <button 
                  onClick={() => setSelectedMarker(null)} 
                  className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-800 transition-colors ml-4"
                >
                  <span className="text-xs font-bold">✕</span>
                </button>
              </div>
              <p className="text-sm text-gray-700 mt-1 leading-relaxed line-clamp-3">
                {selectedMarker.description || "등록된 특징 설명이 없습니다."}
              </p>
              <div className="text-[11px] text-gray-400 mt-3 text-right">
                {formatDate(selectedMarker.created_at)}
              </div>
            </div>
            {/* 말풍선 꼬리 */}
            <div className="w-4 h-4 bg-white transform rotate-45 -translate-y-2 border-b border-r border-gray-100 -z-0"></div>
          </div>
        </CustomOverlayMap>
      )}

      {/* 🎨 클러스터 목록 정보창 (리스트 스타일) */}
      {selectedCluster && (
        <CustomOverlayMap 
          position={selectedCluster.center} 
          yAnchor={1.15}
          clickable={true} 
        >
          <div className="relative flex flex-col items-center drop-shadow-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 w-80 max-h-[340px] flex flex-col overflow-hidden z-10">
              {/* 리스트 헤더 */}
              <div className="bg-gray-50/90 backdrop-blur-sm p-4 border-b border-gray-100 flex justify-between items-center sticky top-0 z-20">
                <div className="font-bold text-gray-800 flex items-center gap-2 text-sm">
                  📋 이 주변 발견 신고
                  <span className="bg-blue-600 text-white px-2 py-0.5 rounded-full text-[11px]">
                    {selectedCluster.markers.length}
                  </span>
                </div>
                <button 
                  onClick={() => setSelectedCluster(null)} 
                  className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                >
                  <span className="text-sm font-bold">✕</span>
                </button>
              </div>
              
              {/* 리스트 목록 */}
              <ul className="overflow-y-auto divide-y divide-gray-50">
                {selectedCluster.markers.map((marker) => (
                  <li 
                    key={marker.id} 
                    className="cursor-pointer hover:bg-slate-50 active:bg-slate-100 p-4 transition-all duration-200 group"
                    onClick={() => handleListItemClick(marker)}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className={`text-sm font-semibold flex items-center gap-1.5 ${marker.animal_type === "DOG" ? "text-blue-700" : "text-orange-700"}`}>
                        {marker.animal_type === "DOG" ? "🐶 강아지" : "🐱 고양이"}
                      </div>
                      <span className="text-[11px] text-gray-400 group-hover:text-gray-500">
                        {formatDate(marker.created_at)}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 leading-snug line-clamp-2">
                      {marker.description || "등록된 특징이 없습니다."}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* 말풍선 꼬리 */}
            <div className="w-5 h-5 bg-white transform rotate-45 -translate-y-2.5 border-b border-r border-gray-100 -z-0"></div>
          </div>
        </CustomOverlayMap>
      )}
    </>
  );
}

// 메인 페이지 컴포넌트
export default function Home() {
  const [loading, setLoading] = useState(true);
  const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&libraries=services,clusterer&autoload=false`;

  const handleScriptLoad = () => {
    window.kakao.maps.load(() => {
      setLoading(false);
    });
  };

  return (
    <>
      <Script src={KAKAO_SDK_URL} strategy="afterInteractive" onLoad={handleScriptLoad} />
      <main className="w-full h-screen bg-gray-50">
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full h-full text-gray-600">
            <div className="animate-bounce text-4xl mb-4">🗺️</div>
            <div className="text-lg font-semibold animate-pulse">멍냥신고 지도 로딩 중...</div>
          </div>
        ) : (
          <KakaoMap center={{ lat: 37.5665, lng: 126.9780 }} style={{ width: "100%", height: "100%" }} level={8}>
            <MapWithLogic />
          </KakaoMap>
        )}
      </main>
    </>
  );
}