import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";
import VehiclesPage from "../pages/vehicles/VehiclesPage";
import VehicleDetailPage from "../pages/vehicles/VehicleDetailPage";
import VehicleFormPage from "../pages/vehicles/VehicleFormPage";
import CustomersPage from "../pages/customers/CustomersPage";
import CustomerFormPage from "../pages/customers/CustomerFormPage";
import TestDrivesPage from "../pages/testdrives/TestDrivesPage";
import TestDriveFormPage from "../pages/testdrives/TestDriveFormPage";
import SalesPage from "../pages/sales/SalesPage";
import SaleFormPage from "../pages/sales/SaleFormPage";
import ServicePage from "../pages/service/ServicePage";
import ServiceFormPage from "../pages/service/ServiceFormPage";
import CommissionsPage from "../pages/commissions/CommissionsPage";
import EnquiriesPage from "../pages/enquiries/EnquiriesPage";
import EnquiryThreadPage from "../pages/enquiries/EnquiryThreadPage";
import RestockPriorityPage from "../pages/restock/RestockPriorityPage";
import ReviewModerationPage from "../pages/reviews/ReviewModerationPage";
import TradeInsStaffPage from "../pages/tradeins/TradeInsPage";
import ServiceBookingsStaffPage from "../pages/servicebookings/ServiceBookingsStaffPage";
import EmailLogPage from "../pages/emaillog/EmailLogPage";
import ReservationsStaffPage from "../pages/reservations/ReservationsStaffPage";
import StaffPage from "../pages/staff/StaffPage";

const ALL_ROLES = ["manager", "sales_executive", "technician", "receptionist"];
const MANAGER_SALES = ["manager", "sales_executive"];
const MANAGER_SALES_RECEP = ["manager", "sales_executive", "receptionist"];
const MANAGER_TECH_RECEP = ["manager", "technician", "receptionist"];

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Root redirect */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard — manager only */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <DashboardPage />
            </ProtectedRoute>
          }
        />

        {/* Vehicles — all roles */}
        <Route
          path="/vehicles"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <VehiclesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicles/new"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <VehicleFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicles/:id/edit"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <VehicleFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/vehicles/:id"
          element={
            <ProtectedRoute allowedRoles={ALL_ROLES}>
              <VehicleDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Customers */}
        <Route
          path="/customers"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <CustomersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/new"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <CustomerFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/customers/:id/edit"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <CustomerFormPage />
            </ProtectedRoute>
          }
        />

        {/* Test Drives */}
        <Route
          path="/test-drives"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <TestDrivesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-drives/new"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <TestDriveFormPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/test-drives/:id/edit"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <TestDriveFormPage />
            </ProtectedRoute>
          }
        />

        {/* Sales */}
        <Route
          path="/sales"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <SalesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales/new"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <SaleFormPage />
            </ProtectedRoute>
          }
        />

        {/* Service */}
        <Route
          path="/service"
          element={
            <ProtectedRoute allowedRoles={MANAGER_TECH_RECEP}>
              <ServicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/service/new"
          element={
            <ProtectedRoute allowedRoles={MANAGER_TECH_RECEP}>
              <ServiceFormPage />
            </ProtectedRoute>
          }
        />
        {/* Service edit route — needed for onRowClick in ServicePage */}
        <Route
          path="/service/:id/edit"
          element={
            <ProtectedRoute allowedRoles={MANAGER_TECH_RECEP}>
              <ServiceFormPage />
            </ProtectedRoute>
          }
        />

        {/* Commissions */}
        <Route
          path="/commissions"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <CommissionsPage />
            </ProtectedRoute>
          }
        />

        {/* Trade-ins — manager + sales_executive per spec 7.7 */}
        <Route
          path="/trade-ins"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <TradeInsStaffPage />
            </ProtectedRoute>
          }
        />

        {/* Restock Priority — manager + sales_executive per spec 7.4 */}
        <Route
          path="/restock-priority"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES}>
              <RestockPriorityPage />
            </ProtectedRoute>
          }
        />

        {/* Review Moderation — manager only per spec 7.6 */}
        <Route
          path="/reviews"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <ReviewModerationPage />
            </ProtectedRoute>
          }
        />

        {/* Service Bookings — manager, receptionist, technician (own) per spec 9.1 */}
        <Route
          path="/service-bookings"
          element={
            <ProtectedRoute allowedRoles={MANAGER_TECH_RECEP}>
              <ServiceBookingsStaffPage />
            </ProtectedRoute>
          }
        />

        {/* Enquiries — manager always; sales_executive/receptionist if handles_enquiries (gated at API + sidebar) */}
        <Route
          path="/enquiries"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <EnquiriesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/enquiries/:id"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <EnquiryThreadPage />
            </ProtectedRoute>
          }
        />

        {/* Email Log — manager only per spec 9 */}
        <Route
          path="/email-log"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <EmailLogPage />
            </ProtectedRoute>
          }
        />

        {/* Reservations — manager, sales_executive, receptionist per spec 11.5 */}
        <Route
          path="/reservations"
          element={
            <ProtectedRoute allowedRoles={MANAGER_SALES_RECEP}>
              <ReservationsStaffPage />
            </ProtectedRoute>
          }
        />

        {/* Staff — manager only per spec 11.5 */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={["manager"]}>
              <StaffPage />
            </ProtectedRoute>
          }
        />

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
