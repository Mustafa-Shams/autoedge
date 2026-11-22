import api from './axiosInstance';

// ── Enquiries (staff) ───────────────────────────────────────────────

export const getEnquiries = (params) => api.get('/api/v1/enquiries', { params });
export const getEnquiry = (id) => api.get(`/api/v1/enquiries/${id}`);
export const replyToEnquiry = (id, data) => api.post(`/api/v1/enquiries/${id}/reply`, data);
export const updateEnquiry = (id, data) => api.put(`/api/v1/enquiries/${id}`, data);
export const toggleEnquiryAccess = (userId, data) => api.put(`/api/v1/enquiries/users/${userId}/enquiry-access`, data);
