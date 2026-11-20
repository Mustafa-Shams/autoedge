import api from './axiosInstance';

// ── Auth (no token needed) ──────────────────────────────────────────

export const register = (data) => api.post('/store/auth/register', data);
export const login = (data) => api.post('/store/auth/login', data);
export const checkEmail = (email) => api.get('/store/auth/check-email', { params: { email } });

// ── Account (customer token required) ───────────────────────────────

export const getProfile = () => api.get('/store/me');
export const updateProfile = (data) => api.put('/store/me', data);
export const changePassword = (data) => api.post('/store/me/change-password', data);

// ── Bank ────────────────────────────────────────────────────────────

export const getBankSummary = () => api.get('/store/bank');
export const getBankTransactions = (params) => api.get('/store/bank/transactions', { params });
export const topUp = (data) => api.post('/store/bank/top-up', data);

// ── Reservations ────────────────────────────────────────────────────

export const createReservation = (data) => api.post('/store/reservations', data);
export const getReservations = (params) => api.get('/store/reservations', { params });
export const getReservation = (id) => api.get(`/store/reservations/${id}`);
export const getReservationReceipt = (id) => api.get(`/store/reservations/${id}/receipt`);
export const cancelReservation = (id) => api.post(`/store/reservations/${id}/cancel`);

// ── Test Drives ─────────────────────────────────────────────────────

export const requestTestDrive = (data) => api.post('/store/test-drives', data);
export const getTestDrives = (params) => api.get('/store/test-drives', { params });
export const cancelTestDrive = (id) => api.post(`/store/test-drives/${id}/cancel`);

// ── Enquiries ───────────────────────────────────────────────────────

export const createEnquiry = (data) => api.post('/store/enquiries', data);
export const getEnquiries = (params) => api.get('/store/enquiries', { params });
export const getEnquiry = (id) => api.get(`/store/enquiries/${id}`);
export const replyToEnquiry = (id, data) => api.post(`/store/enquiries/${id}/messages`, data);
export const closeEnquiry = (id) => api.post(`/store/enquiries/${id}/close`);

// ── Trade-ins ───────────────────────────────────────────────────────

export const createTradeIn = (data) => api.post('/store/trade-ins', data);
export const getTradeIns = (params) => api.get('/store/trade-ins', { params });
export const getTradeIn = (id) => api.get(`/store/trade-ins/${id}`);
export const respondToTradeIn = (id, data) => api.post(`/store/trade-ins/${id}/respond`, data);
export const cancelTradeIn = (id) => api.post(`/store/trade-ins/${id}/cancel`);

// ── Garage ──────────────────────────────────────────────────────────

export const getGarage = () => api.get('/store/garage');
export const addGarageCar = (data) => api.post('/store/garage', data);
export const updateGarageCar = (id, data) => api.put(`/store/garage/${id}`, data);
export const deleteGarageCar = (id) => api.delete(`/store/garage/${id}`);

// ── Service Bookings ────────────────────────────────────────────────

export const createServiceBooking = (data) => api.post('/store/service-bookings', data);
export const getServiceBookings = (params) => api.get('/store/service-bookings', { params });
export const getServiceBookingReceipt = (id) => api.get(`/store/service-bookings/${id}/receipt`);
export const cancelServiceBooking = (id) => api.post(`/store/service-bookings/${id}/cancel`);

// ── Reviews ─────────────────────────────────────────────────────────

export const createReview = (data) => api.post('/store/reviews', data);
export const getMyReviews = (params) => api.get('/store/reviews', { params });
export const updateReview = (id, data) => api.put(`/store/reviews/${id}`, data);
export const deleteReview = (id) => api.delete(`/store/reviews/${id}`);

// ── Restock Requests ────────────────────────────────────────────────

export const requestRestock = (data) => api.post('/store/restock-requests', data);
export const getRestockRequests = (params) => api.get('/store/restock-requests', { params });
export const withdrawRestockRequest = (vehicleId) => api.delete(`/store/restock-requests/${vehicleId}`);

// ── Wishlist ────────────────────────────────────────────────────────

export const getWishlist = () => api.get('/store/wishlist');
export const addToWishlist = (vehicleId) => api.post(`/store/wishlist/${vehicleId}`);
export const removeFromWishlist = (vehicleId) => api.delete(`/store/wishlist/${vehicleId}`);

// ── Notifications ───────────────────────────────────────────────────

export const getNotifications = (params) => api.get('/store/notifications', { params });
export const getUnreadCount = () => api.get('/store/notifications/unread-count');
export const markRead = (id) => api.post(`/store/notifications/${id}/read`);
export const markAllRead = () => api.post('/store/notifications/read-all');
