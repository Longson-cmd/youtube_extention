export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export const API_ENDPOINTS = {
  login: `${API_BASE_URL}/jwt_login/`,
  refresh: `${API_BASE_URL}/jwt_refresh/`,
  subtitles: `${API_BASE_URL}/subtitles/`,
};
