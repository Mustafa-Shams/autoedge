import api from "./axiosInstance";
export const vehiclesApi = {
  list:      (params) => api.get("/api/v1/vehicles/", { params }),
  available: ()       => api.get("/api/v1/vehicles/available"),
  get:       (id)     => api.get(`/api/v1/vehicles/${id}`),
  create:    (data)   => api.post("/api/v1/vehicles/", data),
  update:    (id, data) => api.put(`/api/v1/vehicles/${id}`, data),
  delete:    (id)     => api.delete(`/api/v1/vehicles/${id}`),
};
