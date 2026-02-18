import TimesheetsListClient from "@/components/timesheets/TimesheetsClient";

export const revalidate = 60;

export default function AdminTimesheetsPage() {
  return <TimesheetsListClient mode="ADMIN" />;
}
