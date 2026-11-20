import api from "./axiosInstance";
export const salesApi = {
  list:   (params)   => api.get("/api/v1/sales/", { params }).then(r => r.data),
  stats:  ()         => api.get("/api/v1/sales/stats").then(r => r.data),
  get:    (id)       => api.get(`/api/v1/sales/${id}`).then(r => r.data),
  create: (data)     => api.post("/api/v1/sales/", data).then(r => r.data),
  update: (id, data) => api.put(`/api/v1/sales/${id}`, data).then(r => r.data),
  // P46: Get customer's active reservations and accepted trade-ins
  getCustomerCredits: (customerId) => api.get(`/api/v1/sales/customer-credits/${customerId}`).then(r => r.data),
};
