"use client";

import React, { useState } from "react";
import Navbar from "@/components/common/Navbar";
import Sidebar from "@/components/common/Sidebar";
import type { UserRole } from "@/lib/roles";

type AppShellProps = {
  children: React.ReactNode;
  role: UserRole;
};

export function AppShell({ children, role }: AppShellProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar isOpen={isSidebarOpen} role={role} />
      <div className="flex flex-1 flex-col">
        <Navbar
          isSidebarOpen={isSidebarOpen}
          onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
          role={role}
        />
        <main className="flex-1 overflow-auto py-3 px-4">{children}</main>
      </div>
    </div>
  );
}
