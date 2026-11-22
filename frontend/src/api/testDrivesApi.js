import api from "./axiosInstance";
export const testDrivesApi = {
  salesStaff: () => api.get("/api/v1/test-drives/sales-staff").then(r => r.data),
  list:    (params)   => api.get("/api/v1/test-drives/", { params }).then(r => r.data),
  get:     (id)       => api.get(`/api/v1/test-drives/${id}`).then(r => r.data),
  create:  (data)     => api.post("/api/v1/test-drives/", data).then(r => r.data),
  update:  (id, data) => api.put(`/api/v1/test-drives/${id}`, data).then(r => r.data),
  cancel:  (id)       => api.delete(`/api/v1/test-drives/${id}`).then(r => r.data),
  // P46: Confirm / Decline online requests
  confirm: (id, data) => api.post(`/api/v1/test-drives/${id}/confirm`, data || {}).then(r => r.data),
  decline: (id, data) => api.post(`/api/v1/test-drives/${id}/decline`, data).then(r => r.data),
};
