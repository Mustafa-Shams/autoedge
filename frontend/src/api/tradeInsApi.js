/**
 * Staff Trade-In API calls.
 * Spec 7.7, 10.4.
 */
import axiosInstance from './axiosInstance';

/**
 * GET /trade-ins — list all trade-in requests with optional status filter.
 * [manager, sales_executive]
 */
export const getTradeIns = (params) => axiosInstance.get('/api/v1/trade-ins', { params });

/**
 * GET /trade-ins/{id} — detail with images.
 * [manager, sales_executive]
 */
export const getTradeIn = (id) => axiosInstance.get(`/api/v1/trade-ins/${id}`);

/**
 * PUT /trade-ins/{id} — update status/offered_value/staff_notes.
 * @param {number} id
 * @param {{ status?, offered_value?, staff_notes? }} data
 * [manager, sales_executive]
 */
export const updateTradeIn = (id, data) => axiosInstance.put(`/api/v1/trade-ins/${id}`, data);
export const processAcquisition = (id, data) => axiosInstance.post(`/api/v1/trade-ins/${id}/acquisition`, data);
