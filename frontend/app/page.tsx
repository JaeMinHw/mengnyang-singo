"use client"; // 이 페이지 전체를 클라이언트 컴포넌트로 만듭니다.

import { Map, MapMarker } from "react-kakao-maps-sdk";
import Script from "next/script";
import { useState } from "react";

export default function Home() {
  const [isLoaded, setIsLoaded] = useState(false);
  const KAKAO_SDK_URL = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${process.env.NEXT_PUBLIC_KAKAO_MAP_API_KEY}&autoload=false`;

  return (
    <>
      <Script
        src={KAKAO_SDK_URL}
        strategy="afterInteractive"
        onReady={() => setIsLoaded(true)}
      />
      <main className="w-full h-screen">
        {isLoaded ? (
          <Map
            center={{ lat: 37.5665, lng: 126.9780 }}
            style={{ width: "100%", height: "100%" }}
            level={3}
          >
            <MapMarker position={{ lat: 37.5665, lng: 126.9780 }}>
              <div style={{ color: "#000" }}>멍냥신고 테스트!</div>
            </MapMarker>
          </Map>
        ) : (
          <div>지도 로딩 중...</div>
        )}
      </main>
    </>
  );
}