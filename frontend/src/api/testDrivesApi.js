import api from "./axiosInstance";
export const testDrivesApi = {
  list:   (params)   => api.get("/api/v1/test-drives/", { params }),
  get:    (id)       => api.get(`/api/v1/test-drives/${id}`),
  create: (data)     => api.post("/api/v1/test-drives/", data),
  update: (id, data) => api.put(`/api/v1/test-drives/${id}`, data),
  cancel: (id)       => api.delete(`/api/v1/test-drives/${id}`),
};
