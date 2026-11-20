import api from './axiosInstance';

// ── Enquiries (staff) ───────────────────────────────────────────────

export const getEnquiries = (params) => api.get('/enquiries', { params });
export const getEnquiry = (id) => api.get(`/enquiries/${id}`);
export const replyToEnquiry = (id, data) => api.post(`/enquiries/${id}/reply`, data);
export const updateEnquiry = (id, data) => api.put(`/enquiries/${id}`, data);
export const toggleEnquiryAccess = (userId, data) => api.put(`/enquiries/users/${userId}/enquiry-access`, data);
