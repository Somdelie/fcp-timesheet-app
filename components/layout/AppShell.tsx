"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import Sidebar from "@/components/common/Sidebar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import type { UserRole } from "@/lib/roles";
import { UserRoleProvider } from "@/lib/user-role-context";
import { SchedulerAlertProvider } from "@/components/scheduler/SchedulerAlertProvider";

type AppShellProps = {
  children: React.ReactNode;
  role: UserRole;
  userName: string;
};

function getBreakpoint() {
  if (typeof window === "undefined") return "desktop";
  if (window.innerWidth < 768) return "mobile";
  if (window.innerWidth < 1024) return "tablet";
  return "desktop";
}

export function AppShell({ children, role, userName }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [breakpoint, setBreakpoint] = useState<"mobile" | "tablet" | "desktop">("desktop");
  const pathname = usePathname();
  const hasLoggedOpen = useRef(false);

  // Set initial state and listen for resize
  useEffect(() => {
    const update = () => {
      const bp = getBreakpoint();
      setBreakpoint(bp);
      // Desktop defaults open, tablet/mobile default closed
      if (bp === "desktop") setIsSidebarOpen(true);
      else setIsSidebarOpen(false);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  // Close sidebar on navigation on mobile/tablet
  useEffect(() => {
    if (breakpoint !== "desktop") setIsSidebarOpen(false);
  }, [pathname, breakpoint]);

  // Log once when an admin opens the app (visits the home/dashboard page)
  useEffect(() => {
    if (role !== "ADMIN" || hasLoggedOpen.current) return;
    if (pathname !== "/") return;
    hasLoggedOpen.current = true;
    fetch("/api/admin/page-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/" }),
    }).catch(() => {});
  }, [pathname, role]);

  const isOverlay = breakpoint !== "desktop";

  return (
    <BreadcrumbProvider>
      <UserRoleProvider role={role}>
        <SchedulerAlertProvider />
        <div className="flex h-full bg-background text-foreground">
          {/* Backdrop for mobile/tablet overlay */}
          {isOverlay && isSidebarOpen && (
            <div
              className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          <Sidebar
            isOpen={isSidebarOpen}
            isOverlay={isOverlay}
            role={role}
            userName={userName}
          />

          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <Navbar
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              role={role}
            />
            <main className="flex-1 overflow-auto w-full py-3 px-4 min-h-0">
              {children}
            </main>
          </div>
        </div>
      </UserRoleProvider>
    </BreadcrumbProvider>
  );
}
