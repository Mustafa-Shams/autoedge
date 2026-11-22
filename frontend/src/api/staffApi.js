import api from "./axiosInstance";

const users = "/api/v1/users";
const technicians = "/api/v1/technician-profiles";

export const staffApi = {
  list: (params) => api.get(users + "/", { params }).then((r) => r.data),
  get: (id) => api.get(users + "/" + id).then((r) => r.data),
  activity: (id) => api.get(users + "/" + id + "/activity").then((r) => r.data),
  create: (data) => api.post(users + "/", data).then((r) => r.data),
  update: (id, data) => api.put(users + "/" + id, data).then((r) => r.data),
  toggleEnquiries: (id, value) => api.put(users + "/" + id + "/enquiry-access", { handles_enquiries: value }).then((r) => r.data),
  resetPassword: (id, data) => api.post(users + "/" + id + "/reset-password", data),
  deactivate: (id) => api.delete(users + "/" + id),
  remove: (id) => api.delete(users + "/" + id + "/permanent"),
  technicians: () => api.get(technicians).then((r) => r.data),
  technician: (id) => api.get(technicians + "/" + id).then((r) => r.data),
  updateTechnician: (id, data) => api.put(technicians + "/" + id, data).then((r) => r.data),
};
