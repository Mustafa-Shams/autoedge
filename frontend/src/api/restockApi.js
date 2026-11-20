/**
 * Staff Restock API calls — reads v_restock_priority view & triggers restock.
 * Spec 7.4, 10.4.
 */
import axiosInstance from './axiosInstance';

/**
 * GET /restock/priority — ranked list of out-of-stock vehicles by request count.
 * [manager, sales_executive]
 */
export const getRestockPriority = () => axiosInstance.get('/api/v1/restock/priority');

/**
 * POST /vehicles/{vehicleId}/restock — add stock and mark all Open requests as Fulfilled.
 * @param {number} vehicleId
 * @param {{ quantity: number }} data
 * [manager, sales_executive]
 */
export const restockVehicle = (vehicleId, data) =>
  axiosInstance.post(`/api/v1/vehicles/${vehicleId}/restock`, data);
