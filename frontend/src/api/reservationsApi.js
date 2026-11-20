import axiosInstance from "./axiosInstance";

const reservationsApi = {
  /**
   * List all reservations (staff view) with optional filters.
   * @param {Object} params - Query parameters
   * @param {string} [params.status_filter] - Filter by status (Active, Completed, Cancelled, Expired)
   * @param {number} [params.vehicle_id] - Filter by vehicle
   * @param {number} [params.customer_id] - Filter by customer
   * @param {number} [params.page] - Page number (default 1)
   * @param {number} [params.page_size] - Page size (default 20)
   */
  getAll(params = {}) {
    return axiosInstance.get("/api/v1/reservations", { params });
  },

  /**
   * Get a single reservation detail.
   * @param {number} id - Reservation ID
   */
  getById(id) {
    return axiosInstance.get(`/api/v1/reservations/${id}`);
  },

  /**
   * Cancel a reservation (manager only) with refund.
   * @param {number} id - Reservation ID
   */
  cancel(id) {
    return axiosInstance.post(`/api/v1/reservations/${id}/cancel`);
  },
};

export default reservationsApi;
