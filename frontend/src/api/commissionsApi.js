import api from "./axiosInstance";
export const commissionsApi = {
  list:    (params)   => api.get("/api/v1/commissions/", { params }),
  summary: ()         => api.get("/api/v1/commissions/summary"),
  get:     (id)       => api.get(`/api/v1/commissions/${id}`),
  update:  (id, data) => api.put(`/api/v1/commissions/${id}`, data),
};
