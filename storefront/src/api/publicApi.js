import api from './axiosInstance';

// ── Public endpoints (no auth) ──────────────────────────────────────

export const getVehicles = (params) => api.get('/public/vehicles', { params });
export const getVehicleFilters = () => api.get('/public/vehicles/filters');
export const getFeaturedVehicles = () => api.get('/public/vehicles/featured');
export const getVehicleDetail = (id) => api.get(`/public/vehicles/${id}`);
export const getVehicleReviews = (id, params) => api.get(`/public/vehicles/${id}/reviews`, { params });
export const compareVehicles = (ids) => api.get('/public/vehicles/compare', { params: { ids } });
export const getTestDriveSlots = (vehicleId, date) =>
  api.get('/public/test-drive-slots', { params: { vehicle_id: vehicleId, date } });
export const getServiceTypes = () => api.get('/public/service-types');
export const getTechnicians = (specialty) =>
  api.get('/public/technicians', { params: specialty ? { specialty } : {} });
export const getTechnicianAvailability = (id, date) =>
  api.get(`/public/technicians/${id}/availability`, { params: { date } });
