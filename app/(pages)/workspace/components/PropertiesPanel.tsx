import { Info, MessageSquare, CheckCircle2, CalendarDays } from "lucide-react";

const fileDetails = [
  { label: "Document", value: "Lodge west wing drawing" },
  { label: "Type", value: "Drawings & BOQ" },
  { label: "Status", value: "Review pending" },
  { label: "Updated", value: "Today, 10:12" },
  { label: "Owner", value: "Site team" },
];

const comments = [
  {
    author: "Mpho",
    text: "Please confirm the steel note on page 8.",
    time: "2h ago",
  },
  {
    author: "Naledi",
    text: "Safety file needs the latest permit.",
    time: "4h ago",
  },
];

const approvals = [
  { label: "HS&E check", status: "Awaiting" },
  { label: "Client sign-off", status: "Ready" },
  { label: "Delivery schedule", status: "Approved" },
];

function DetailsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-3xl border border-white/10 bg-slate-950/75 px-4 py-3 text-sm text-slate-300">
      <span>{label}</span>
      <span className="font-medium text-slate-100">{value}</span>
    </div>
  );
}

export function DetailsPanel() {
  return <div className="">Details</div>;
}
