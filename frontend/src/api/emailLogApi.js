/**
 * Staff Email Log API calls — spec 10.4.
 */
import axiosInstance from './axiosInstance';

/**
 * GET /api/v1/email-log — list all email outbox entries [manager].
 */
export const getEmailLog = (params) => axiosInstance.get('/api/v1/email-log', { params });
