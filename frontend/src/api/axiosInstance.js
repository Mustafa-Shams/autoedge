import axios from "axios";
import { authStore } from "../store/authStore";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:8000",
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach Bearer token
axiosInstance.interceptors.request.use((config) => {
  const { token } = authStore.getState();
  if (token && !config.headers.Authorization) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: redirect to login on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const providerUnauthorized = error.config?.url === "/api/v1/email-log/test"
      && error.response?.data?.provider_status === 401;
    if (error.response?.status === 401 && error.config?.url !== "/api/v1/auth/login" && !providerUnauthorized) {
      authStore.logout();
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
