const STATUS_STYLES = {
  // Vehicle status
  Available: "bg-status-available/20 text-status-available",
  Reserved: "bg-status-reserved/20 text-status-reserved",
  Sold: "bg-status-sold/20 text-status-sold",
  // General
  Pending: "bg-status-reserved/20 text-status-reserved",
  Completed: "bg-status-available/20 text-status-available",
  Cancelled: "bg-status-cancelled/20 text-status-cancelled",
  "In Progress": "bg-status-scheduled/20 text-status-scheduled",
  // Test drive status
  Scheduled: "bg-status-scheduled/20 text-status-scheduled",
  "No-Show": "bg-status-cancelled/20 text-status-cancelled",
  // Lead status
  New: "bg-bg-elevated text-text-secondary",
  Interested: "bg-accent-blue/20 text-accent-blue",
  Hot: "bg-status-reserved/20 text-status-reserved",
  Converted: "bg-status-available/20 text-status-available",
  Lost: "bg-status-cancelled/20 text-status-cancelled",
  // Commission status
  Approved: "bg-status-scheduled/20 text-status-scheduled",
  Paid: "bg-status-available/20 text-status-available",
};

export default function StatusBadge({ status }) {
  const style = STATUS_STYLES[status] ?? "bg-bg-elevated text-text-muted";
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${style}`}
    >
      {status}
    </span>
  );
}

