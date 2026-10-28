import api from "./axiosInstance";
export const commissionsApi = {
  list:    (params)   => api.get("/api/v1/commissions/", { params }).then(r => r.data),
  summary: ()         => api.get("/api/v1/commissions/summary").then(r => r.data),
  get:     (id)       => api.get(`/api/v1/commissions/${id}`).then(r => r.data),
  update:  (id, data) => api.put(`/api/v1/commissions/${id}`, data).then(r => r.data),
};
