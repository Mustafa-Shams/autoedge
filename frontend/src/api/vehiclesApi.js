import api from "./axiosInstance";
export const vehiclesApi = {
  list:      (params) => api.get("/api/v1/vehicles/", { params }).then(r => r.data),
  available: ()       => api.get("/api/v1/vehicles/available").then(r => r.data),
  get:       (id)     => api.get(`/api/v1/vehicles/${id}`).then(r => r.data),
  create:    (data)   => api.post("/api/v1/vehicles/", data).then(r => r.data),
  update:    (id, data) => api.put(`/api/v1/vehicles/${id}`, data).then(r => r.data),
  delete:    (id)     => api.delete(`/api/v1/vehicles/${id}`).then(r => r.data),
};
