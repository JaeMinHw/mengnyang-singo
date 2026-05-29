import axios from "axios";
import { getAccessToken } from "@/lib/auth";

// 백엔드 API 서버의 기본 주소
const API_URL = "/api";

// 'api'라는 이름의 axios 인스턴스 생성
const api = axios.create({
  baseURL: API_URL,
});

// 요청을 보내기 전에 access token이 있으면 자동으로 Authorization 헤더 추가
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getAccessToken();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  return config;
});

export default api;