import api from "./axiosInstance";
export const customersApi = {
  list:    (params)   => api.get("/api/v1/customers/", { params }),
  get:     (id)       => api.get(`/api/v1/customers/${id}`),
  create:  (data)     => api.post("/api/v1/customers/", data),
  update:  (id, data) => api.put(`/api/v1/customers/${id}`, data),
  history: (id)       => api.get(`/api/v1/customers/${id}/history`),
};
