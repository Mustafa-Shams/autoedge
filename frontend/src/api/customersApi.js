import api from "./axiosInstance";
export const customersApi = {
  list:    (params)   => api.get("/api/v1/customers/", { params }).then(r => r.data),
  get:     (id)       => api.get(`/api/v1/customers/${id}`).then(r => r.data),
  create:  (data)     => api.post("/api/v1/customers/", data).then(r => r.data),
  update:  (id, data) => api.put(`/api/v1/customers/${id}`, data).then(r => r.data),
  history: (id)       => api.get(`/api/v1/customers/${id}/history`).then(r => r.data),
};
