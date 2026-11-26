import api from "./axiosInstance";
export const salesApi = {
  list:   (params)   => api.get("/api/v1/sales/", { params }).then(r => r.data),
  stats:  ()         => api.get("/api/v1/sales/stats").then(r => r.data),
  get:    (id)       => api.get(`/api/v1/sales/${id}`).then(r => r.data),
  create: (data)     => api.post("/api/v1/sales/", data).then(r => r.data),
  update: (id, data) => api.put(`/api/v1/sales/${id}`, data).then(r => r.data),
  handover: (id, vin, reference) => api.post(`/api/v1/sales/${id}/handover`, { vin, settlement_reference: reference }).then(r => r.data),
  approveRefund: (id, agreeTradeReturn) => api.post(`/api/v1/sales/${id}/approve-refund`, { agree_trade_return: agreeTradeReturn }).then(r => r.data),
  verifyPayment: (id, data) => api.post(`/api/v1/sales/${id}/payment`, data).then(r => r.data),
  schedulePickup: (id, deadline) => api.post(`/api/v1/sales/${id}/pickup-deadline`, { deadline }).then(r => r.data),
  conversation: (id) => api.post(`/api/v1/sales/${id}/conversation`).then(r => r.data),
  // P46: Get customer's active reservations and accepted trade-ins
  getCustomerCredits: (customerId) => api.get(`/api/v1/sales/customer-credits/${customerId}`).then(r => r.data),
};
