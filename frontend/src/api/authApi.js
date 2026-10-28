import api from "./axiosInstance";

export const authApi = {
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api
      .post("/api/v1/auth/login", form, {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })
      .then((r) => r.data);
  },
  me: () => api.get("/api/v1/auth/me").then((r) => r.data),
};
