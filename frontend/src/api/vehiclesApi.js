import api from "./axiosInstance";
export const vehiclesApi = {
  list:      (params) => api.get("/api/v1/vehicles/", { params }).then(r => r.data),
  // list() now returns { items: [...], total, skip, limit }
  available: ()       => api.get("/api/v1/vehicles/available").then(r => r.data),
  get:       (id)     => api.get(`/api/v1/vehicles/${id}`).then(r => r.data),
  create:    (data)   => api.post("/api/v1/vehicles/", data).then(r => r.data),
  update:    (id, data) => api.put(`/api/v1/vehicles/${id}`, data).then(r => r.data),
  delete:    (id)     => api.delete(`/api/v1/vehicles/${id}`).then(r => r.data),
  // P46: Vehicle image management
  addImage:    (vehicleId, data) => api.post(`/api/v1/vehicles/${vehicleId}/images`, data).then(r => r.data),
  deleteImage: (vehicleId, imageId) => api.delete(`/api/v1/vehicles/${vehicleId}/images/${imageId}`).then(r => r.data),
  // Decision #23: Bulk image replacement — atomic save of main + additional images
  replaceImages: (vehicleId, data) => api.put(`/api/v1/vehicles/${vehicleId}/images/bulk`, data).then(r => r.data),
};
