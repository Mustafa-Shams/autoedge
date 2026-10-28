import api from "./axiosInstance";
export const serviceApi = {
  list:       (params)            => api.get("/api/v1/service/", { params }),
  get:        (id)                => api.get(`/api/v1/service/${id}`),
  create:     (data)              => api.post("/api/v1/service/", data),
  update:     (id, data)          => api.put(`/api/v1/service/${id}`, data),
  addPart:    (id, data)          => api.post(`/api/v1/service/${id}/parts`, data),
  listParts:  (id)                => api.get(`/api/v1/service/${id}/parts`),
  deletePart: (id, partId)        => api.delete(`/api/v1/service/${id}/parts/${partId}`),
};
