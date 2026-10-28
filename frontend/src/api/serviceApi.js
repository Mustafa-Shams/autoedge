import api from "./axiosInstance";
export const serviceApi = {
  list:       (params)       => api.get("/api/v1/service/", { params }).then(r => r.data),
  get:        (id)           => api.get(`/api/v1/service/${id}`).then(r => r.data),
  create:     (data)         => api.post("/api/v1/service/", data).then(r => r.data),
  update:     (id, data)     => api.put(`/api/v1/service/${id}`, data).then(r => r.data),
  addPart:    (id, data)     => api.post(`/api/v1/service/${id}/parts`, data).then(r => r.data),
  listParts:  (id)           => api.get(`/api/v1/service/${id}/parts`).then(r => r.data),
  deletePart: (id, partId)   => api.delete(`/api/v1/service/${id}/parts/${partId}`).then(r => r.data),
};
