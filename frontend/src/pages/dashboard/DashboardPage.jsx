import { useQuery } from "@tanstack/react-query";
import {
  Car, CheckCircle, TrendingUp, Wrench, DollarSign,
  Bookmark, CalendarCheck, MessageSquare, PackageX,
} from "lucide-react";
import axios from "../../api/axiosInstance";
import PageWrapper from "../../components/layout/PageWrapper";
import SalesBarChart from "../../components/charts/SalesBarChart";
import LoadingSpinner from "../../components/common/LoadingSpinner";
import { formatCurrency } from "../../utils/formatters";

function StatCard({ icon: Icon, label, value, color = "text-accent-blue" }) {
  return (
    <div className="bg-bg-card border border-bg-border rounded-xl p-5 flex items-center gap-4">
      <div className={`p-3 rounded-xl bg-bg-elevated ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
        <p className="text-2xl font-bold text-text-primary mt-0.5">{value}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: () => axios.get("/api/v1/dashboard/stats").then((r) => r.data),
  });

  const { data: monthly = [], isLoading: monthlyLoading } = useQuery({
    queryKey: ["dashboard-monthly"],
    queryFn: () => axios.get("/api/v1/dashboard/monthly").then((r) => r.data),
  });

  const { data: topStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ["dashboard-top-staff"],
    queryFn: () => axios.get("/api/v1/dashboard/top-staff").then((r) => r.data),
  });

  if (statsLoading) return <PageWrapper><LoadingSpinner /></PageWrapper>;

  return (
    <PageWrapper>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Dashboard</h2>
          <p className="text-sm text-text-secondary mt-0.5">Showroom performance overview</p>
        </div>

        {/* Original KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard icon={Car} label="Total Vehicles" value={stats?.total_vehicles ?? 0} />
          <StatCard icon={CheckCircle} label="Available" value={stats?.available_vehicles ?? 0} color="text-status-available" />
          <StatCard icon={TrendingUp} label="Sold This Month" value={stats?.sold_this_month ?? 0} color="text-status-sold" />
          <StatCard
            icon={DollarSign}
            label="Revenue (Month)"
            value={formatCurrency(stats?.total_revenue_this_month ?? 0)}
            color="text-status-available"
          />
          <StatCard icon={Wrench} label="Pending Service" value={stats?.pending_service_jobs ?? 0} color="text-status-reserved" />
        </div>

        {/* P46: Storefront KPI Cards */}
        <div>
          <h3 className="text-sm font-semibold text-text-muted uppercase tracking-wide mb-3">
            Storefront Activity
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              icon={Bookmark}
              label="Active Reservations"
              value={stats?.active_reservations ?? 0}
              color="text-accent-blue"
            />
            <StatCard
              icon={CalendarCheck}
              label="Pending Test Drive Requests"
              value={stats?.pending_test_drive_requests ?? 0}
              color="text-yellow-400"
            />
            <StatCard
              icon={MessageSquare}
              label="Open Enquiries"
              value={stats?.open_enquiries ?? 0}
              color="text-purple-400"
            />
            <StatCard
              icon={PackageX}
              label="Out-of-Stock with Requests"
              value={stats?.out_of_stock_with_requests ?? 0}
              color="text-status-cancelled"
            />
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Monthly Revenue Chart */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-5">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Monthly Revenue</h3>
            {monthlyLoading ? (
              <LoadingSpinner message="Loading chart..." />
            ) : monthly.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No sales data yet.</p>
            ) : (
              <SalesBarChart data={monthly} />
            )}
          </div>

          {/* Top Staff Table */}
          <div className="bg-bg-card border border-bg-border rounded-xl p-5">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Top Sales Staff</h3>
            {staffLoading ? (
              <LoadingSpinner message="Loading..." />
            ) : topStaff.length === 0 ? (
              <p className="text-sm text-text-muted py-8 text-center">No sales recorded yet.</p>
            ) : (
              <div className="space-y-3">
                {topStaff.map((s, i) => (
                  <div key={s.staff_id} className="flex items-center justify-between py-2 border-b border-bg-border last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-accent-blue/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-accent-blue">#{i + 1}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-text-primary">{s.staff_name}</p>
                        <p className="text-xs text-text-muted">{s.total_sales} sale{s.total_sales !== 1 ? "s" : ""}</p>
                      </div>
                    </div>
                    <span className="text-sm font-semibold text-status-available">
                      {formatCurrency(s.total_commission)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </PageWrapper>
  );
}
