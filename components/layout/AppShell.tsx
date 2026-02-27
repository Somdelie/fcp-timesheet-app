"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import Sidebar from "@/components/common/Sidebar";
import { BreadcrumbProvider } from "@/lib/breadcrumb-context";
import type { UserRole } from "@/lib/roles";
import { UserRoleProvider } from "@/lib/user-role-context";

type AppShellProps = {
  children: React.ReactNode;
  role: UserRole;
};

export function AppShell({ children, role }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const pathname = usePathname();
  const hasLoggedOpen = useRef(false);

  // Log once when an admin opens the app (visits the home/dashboard page)
  useEffect(() => {
    if (role !== "ADMIN" || hasLoggedOpen.current) return;
    // Only fire on the root dashboard page
    if (pathname !== "/") return;
    hasLoggedOpen.current = true;
    fetch("/api/admin/page-visit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ path: "/" }),
    }).catch(() => {});
  }, [pathname, role]);

  return (
    <BreadcrumbProvider>
      <UserRoleProvider role={role}>
        <div className="flex h-screen bg-background text-foreground">
          <Sidebar isOpen={isSidebarOpen} role={role} />
          <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
            <Navbar
              isSidebarOpen={isSidebarOpen}
              onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
              role={role}
            />
            <main className="flex-1 overflow-auto w-full py-3 px-4">
              {children}
            </main>
          </div>
        </div>
      </UserRoleProvider>
    </BreadcrumbProvider>
  );
}
