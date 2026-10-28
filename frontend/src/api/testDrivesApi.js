import api from "./axiosInstance";
export const testDrivesApi = {
  list:   (params)   => api.get("/api/v1/test-drives/", { params }).then(r => r.data),
  get:    (id)       => api.get(`/api/v1/test-drives/${id}`).then(r => r.data),
  create: (data)     => api.post("/api/v1/test-drives/", data).then(r => r.data),
  update: (id, data) => api.put(`/api/v1/test-drives/${id}`, data).then(r => r.data),
  cancel: (id)       => api.delete(`/api/v1/test-drives/${id}`).then(r => r.data),
};
