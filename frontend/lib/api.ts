import axios from "axios";

// 백엔드 API 서버의 기본 주소
const API_URL = "/api";

// 'api'라는 이름의 axios 인스턴스 생성
const api = axios.create({
  baseURL: API_URL, // 앞으로 모든 요청은 이 주소를 기반으로 함
});

export default api;