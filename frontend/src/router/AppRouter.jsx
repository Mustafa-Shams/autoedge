import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import ErrorBoundary from "../components/common/ErrorBoundary";
import PageWrapper from "../components/layout/PageWrapper";
import ProtectedRoute from "./ProtectedRoute";
import { useAuth } from "../hooks/useAuth";
import { staffHome } from "../utils/staffAccess";
import ChangePasswordPage from "../pages/auth/ChangePasswordPage";
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
import StaffDetailPage from "../pages/staff/StaffDetailPage";
import StaffFormPage from "../pages/staff/StaffFormPage";
import TechnicianDetailPage from "../pages/staff/TechnicianDetailPage";

const ALL_ROLES = ["manager", "sales_executive", "technician", "receptionist"];
const MANAGER = ["manager"];
const MANAGER_SALES = ["manager", "sales_executive"];
const MANAGER_SALES_RECEP = ["manager", "sales_executive", "receptionist"];
const MANAGER_TECH_RECEP = ["manager", "technician", "receptionist"];

const staffRoutes = [
  ["/dashboard", DashboardPage, MANAGER, "dashboard"],
  ["/vehicles", VehiclesPage, ALL_ROLES, "vehicles"],
  ["/vehicles/new", VehicleFormPage, MANAGER_SALES, "vehicles", true],
  ["/vehicles/:id/edit", VehicleFormPage, MANAGER_SALES, "vehicles", true],
  ["/vehicles/:id", VehicleDetailPage, ALL_ROLES, "vehicles"],
  ["/customers", CustomersPage, MANAGER_SALES_RECEP, "customers"],
  ["/customers/new", CustomerFormPage, MANAGER_SALES_RECEP, "customers", true],
  ["/customers/:id/edit", CustomerFormPage, MANAGER_SALES_RECEP, "customers", true],
  ["/test-drives", TestDrivesPage, MANAGER_SALES_RECEP, "test_drives"],
  ["/test-drives/new", TestDriveFormPage, MANAGER_SALES_RECEP, "test_drives", true],
  ["/test-drives/:id/edit", TestDriveFormPage, MANAGER_SALES_RECEP, "test_drives", true],
  ["/sales", SalesPage, MANAGER_SALES, "sales"],
  ["/sales/new", SaleFormPage, MANAGER_SALES, "sales", true],
  ["/service", ServicePage, MANAGER_TECH_RECEP, "service"],
  ["/service/new", ServiceFormPage, MANAGER_TECH_RECEP, "service", true],
  ["/service/:id/edit", ServiceFormPage, ["manager", "technician"], "service", true],
  ["/commissions", CommissionsPage, MANAGER_SALES, "commissions"],
  ["/trade-ins", TradeInsStaffPage, MANAGER_SALES, "trade_ins"],
  ["/restock-priority", RestockPriorityPage, MANAGER_SALES, "restock"],
  ["/reviews", ReviewModerationPage, MANAGER, "reviews"],
  ["/service-bookings", ServiceBookingsStaffPage, MANAGER_TECH_RECEP, "service"],
  ["/enquiries", EnquiriesPage, MANAGER_SALES_RECEP, "enquiries"],
  ["/enquiries/:id", EnquiryThreadPage, MANAGER_SALES_RECEP, "enquiries"],
  ["/email-log", EmailLogPage, MANAGER, "email_log"],
  ["/reservations", ReservationsStaffPage, MANAGER_SALES_RECEP, "reservations"],
  ["/staff", StaffPage, MANAGER, "staff"],
  ["/staff/new", StaffFormPage, MANAGER, "staff", true],
  ["/staff/:id", StaffDetailPage, MANAGER, "staff"],
  ["/staff/:id/edit", StaffFormPage, MANAGER, "staff", true],
  ["/staff/technicians/:id", TechnicianDetailPage, MANAGER, "staff"],
];

function StaffHome() {
  const { user } = useAuth();
  return <Navigate to={staffHome(user)} replace />;
}

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<ErrorBoundary><LoginPage /></ErrorBoundary>} />
        <Route element={<ProtectedRoute><Outlet /></ProtectedRoute>}>
          <Route path="/change-password" element={<ErrorBoundary><ChangePasswordPage /></ErrorBoundary>} />
          <Route element={<PageWrapper />}>
            <Route path="/access-unavailable" element={<h1 className="text-xl text-text-primary">No staff modules are available for your account.</h1>} />
            <Route path="/" element={<StaffHome />} />
            {staffRoutes.map(([path, Page, roles, module, write]) => (
              <Route key={path} path={path} element={
                <ProtectedRoute allowedRoles={roles} module={module} write={write}>
                  <Page />
                </ProtectedRoute>
              } />
            ))}
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
