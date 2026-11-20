/**
 * Staff Reviews API calls — review moderation.
 * Spec 7.6, 10.4.
 */
import axiosInstance from './axiosInstance';

/**
 * GET /reviews — list all reviews with filters.
 * @param {Object} params - { is_visible, vehicle_id, rating, page, page_size }
 * [manager]
 */
export const getReviews = (params) => axiosInstance.get('/api/v1/reviews', { params });

/**
 * PUT /reviews/{reviewId}/visibility — toggle is_visible.
 * @param {number} reviewId
 * @param {{ is_visible: boolean }} data
 * [manager]
 */
export const setReviewVisibility = (reviewId, data) =>
  axiosInstance.put(`/api/v1/reviews/${reviewId}/visibility`, data);
