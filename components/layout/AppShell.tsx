"use client";

import React, { useState } from "react";
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
