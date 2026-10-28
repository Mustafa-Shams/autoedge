import api from "./axiosInstance";

export const authApi = {
  login: (email, password) =>
    api.post("/api/v1/auth/login", new URLSearchParams({ username: email, password }), {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }),
  me: () => api.get("/api/v1/auth/me"),
};
