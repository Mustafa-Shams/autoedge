import api from "./axiosInstance";
export const salesApi = {
  list:   (params)   => api.get("/api/v1/sales/", { params }),
  stats:  ()         => api.get("/api/v1/sales/stats"),
  get:    (id)       => api.get(`/api/v1/sales/${id}`),
  create: (data)     => api.post("/api/v1/sales/", data),
  update: (id, data) => api.put(`/api/v1/sales/${id}`, data),
};
