import { InboxIcon } from "lucide-react";

export default function EmptyState({ title = "No data", message = "Nothing to show here yet." }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <InboxIcon className="w-12 h-12 text-text-muted" />
      <h3 className="text-base font-semibold text-text-primary">{title}</h3>
      <p className="text-sm text-text-muted max-w-xs text-center">{message}</p>
    </div>
  );
}

