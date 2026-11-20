/**
 * Staff Service Bookings API calls — spec 7.8, 9.1.
 */
import axiosInstance from './axiosInstance';

/**
 * GET /service-bookings — list all bookings (manager, receptionist, technician own).
 */
export const getServiceBookings = (params) => axiosInstance.get('/api/v1/service-bookings', { params });

/**
 * GET /service-bookings/:id — booking detail.
 */
export const getServiceBooking = (id) => axiosInstance.get(`/api/v1/service-bookings/${id}`);

/**
 * POST /service-bookings/:id/confirm — assign technician, create job, status → Confirmed.
 * @param {number} id
 * @param {{ technician_id: number }} data
 */
export const confirmServiceBooking = (id, data) => axiosInstance.post(`/api/v1/service-bookings/${id}/confirm`, data);
