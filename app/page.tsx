import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";

export const metadata: Metadata = {
  title: "FirstClass Projects – Site & Workforce Management",
  description:
    "The mobile app for First Class Projects field teams. Scan workers, submit timesheets, track wages and manage sites — all from your phone.",
};

const FEATURES = [
  {
    icon: "📷",
    title: "QR Attendance Scanning",
    body: "Foremen scan worker QR codes on arrival. Attendance is recorded instantly with GPS verification and site day photos.",
  },
  {
    icon: "📋",
    title: "Fortnightly Timesheets",
    body: "Workers are tracked per fortnight. Foremen submit, supervisors approve, and payroll is calculated automatically.",
  },
  {
    icon: "📍",
    title: "Site Management",
    body: "Admins manage all active sites, assign supervisors and foremen, track costs and view live wage totals per site.",
  },
  {
    icon: "💰",
    title: "Live Wage Tracking",
    body: "See wages per site in real time. Export PDF reports filtered by fortnight and threshold with one tap.",
  },
  {
    icon: "🔔",
    title: "Push Notifications",
    body: "Instant alerts when timesheets are submitted, approved or rejected. Everyone stays in sync without chasing messages.",
  },
  {
    icon: "🪪",
    title: "Worker ID Cards",
    body: "Generate and download PDF ID cards for any employee directly from the app, complete with a QR code.",
  },
];

const ROLES = [
  {
    role: "Foreman",
    color: "from-amber-500 to-orange-500",
    points: [
      "Scan workers in with QR codes",
      "Log site day photos",
      "Submit fortnightly timesheets",
      "Manage your crew on site",
    ],
  },
  {
    role: "Supervisor",
    color: "from-violet-500 to-purple-600",
    points: [
      "Review & approve timesheets",
      "Monitor attendance across sites",
      "Track foreman activity",
      "Get real-time notifications",
    ],
  },
  {
    role: "Admin",
    color: "from-sky-500 to-blue-600",
    points: [
      "Manage all sites & workers",
      "View wage costs per fortnight",
      "Assign supervisors & foremen",
      "Download reports as PDF",
    ],
  },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) redirect("/dashboard");

  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white font-sans">
      {/* ── Nav ───────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0f1e]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="First Class Projects"
              width={36}
              height={36}
              className="rounded-lg"
            />
            <span className="font-bold text-lg tracking-tight">
              FirstClass
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-sm font-medium text-white/70 hover:text-white transition-colors"
            >
              Sign in
            </Link>
            <a
              href="#download"
              className="text-sm font-semibold px-4 py-2 rounded-full bg-white text-[#0a0f1e] hover:bg-white/90 transition-colors"
            >
              Get the app
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-6 pt-24 pb-20 text-center">
        {/* Glow */}
        <div className="pointer-events-none absolute inset-0 -top-20 flex justify-center">
          <div className="h-[500px] w-[700px] rounded-full bg-blue-600/20 blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-400 uppercase tracking-widest mb-6">
            Now available on iOS & Android
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight mb-6">
            Construction site management,{" "}
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              built for the field
            </span>
          </h1>

          <p className="text-lg text-white/60 max-w-xl mx-auto mb-10 leading-relaxed">
            FirstClass gives foremen, supervisors and admins one app to scan
            workers, approve timesheets, track site costs and stay in sync —
            from anywhere on site.
          </p>

          <div
            id="download"
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            {/* App Store badge */}
            <a
              href="https://apps.apple.com/app/id/com.morrisndlovu.officeapp"
              className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors px-5 py-3 w-48"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 shrink-0">
                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] text-white/50 leading-none">Download on the</p>
                <p className="text-sm font-bold leading-tight">App Store</p>
              </div>
            </a>

            {/* Google Play badge */}
            <a
              href="https://play.google.com/store/apps/details?id=com.morrisndlovu.officeapp"
              className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 transition-colors px-5 py-3 w-48"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="w-7 h-7 shrink-0">
                <path d="M3.18 23.76c.33.18.7.24 1.06.18l11.85-11.85L12.27 8.27 3.18 23.76zm15.6-12.1L16.1 10.1l-2.6 2.6 2.6 2.6 2.7-1.58c.77-.45.77-1.22-.02-1.06zM3.01.55C2.67.74 2.44 1.1 2.44 1.6v20.8c0 .5.23.86.57 1.05l.14.08L14.14 12.5v-.28L3.15.47l-.14.08zm8.7 8.68l3.56-3.56L4.24.55c-.37-.21-.7-.22-1.06-.06L11.71 9.23z" />
              </svg>
              <div className="text-left">
                <p className="text-[10px] text-white/50 leading-none">Get it on</p>
                <p className="text-sm font-bold leading-tight">Google Play</p>
              </div>
            </a>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="px-6 py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-black mb-3">
            Everything your team needs on site
          </h2>
          <p className="text-center text-white/50 mb-14 max-w-lg mx-auto">
            Built specifically for construction — no bloat, just the tools
            foremen and admins actually use every day.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-blue-500/40 hover:bg-white/8 transition-all"
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="font-bold text-base mb-2">{f.title}</h3>
                <p className="text-sm text-white/55 leading-relaxed">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Roles ─────────────────────────────────────────────── */}
      <section className="px-6 py-20 bg-white/[0.02]">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-black mb-3">
            One app, three roles
          </h2>
          <p className="text-center text-white/50 mb-14 max-w-lg mx-auto">
            Each user sees exactly what they need — nothing more.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ROLES.map((r) => (
              <div
                key={r.role}
                className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden"
              >
                <div className={`h-1.5 bg-gradient-to-r ${r.color}`} />
                <div className="p-6">
                  <h3 className="font-black text-xl mb-5">{r.role}</h3>
                  <ul className="space-y-3">
                    {r.points.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-white/70">
                        <span className="mt-0.5 text-green-400 shrink-0">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Privacy Policy ────────────────────────────────────── */}
      <section id="privacy" className="px-6 py-20">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-3xl font-black mb-2">Privacy Policy</h2>
          <p className="text-white/40 text-sm mb-10">Last updated: April 2026</p>

          <div className="space-y-8 text-white/70 text-sm leading-relaxed">
            <div>
              <h3 className="font-bold text-white mb-2">What data we collect</h3>
              <p>
                FirstClass collects employee names, ID numbers, photos, GPS
                location at scan time, attendance records, and timesheet data.
                This information is entered by authorised company staff and is
                used solely for internal workforce and payroll management.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">How we use it</h3>
              <p>
                Data is used to record daily site attendance, process fortnightly
                timesheets, calculate wages, and generate internal reports. It is
                not sold, shared with third parties, or used for advertising.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">Data storage</h3>
              <p>
                All data is stored securely on encrypted cloud infrastructure
                (Neon / PostgreSQL). Access is restricted to authenticated
                company users only. Data is not accessible to the public.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">Device permissions</h3>
              <p>
                The app requests camera access (for QR scanning and worker
                photos), location (to verify scan location on site), photo
                library (to upload worker profile pictures), and push
                notifications (for timesheet alerts). All permissions are used
                only for their stated purpose.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">Your rights</h3>
              <p>
                Employees may request access to or deletion of their personal
                data by contacting their site administrator or emailing us
                directly.
              </p>
            </div>
            <div>
              <h3 className="font-bold text-white mb-2">Contact</h3>
              <p>
                Questions about this policy?{" "}
                <a
                  href="mailto:cautiendlovu94@gmail.com"
                  className="text-blue-400 underline"
                >
                  cautiendlovu94@gmail.com
                </a>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-white/10 px-6 py-10">
        <div className="mx-auto max-w-6xl flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-white/40">
          <div className="flex items-center gap-2">
            <Image src="/logo.png" alt="FCP" width={20} height={20} className="rounded opacity-60" />
            <span>© {new Date().getFullYear()} First Class Projects. All rights reserved.</span>
          </div>
          <div className="flex gap-5">
            <a href="#privacy" className="hover:text-white transition-colors">Privacy Policy</a>
            <Link href="/login" className="hover:text-white transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
