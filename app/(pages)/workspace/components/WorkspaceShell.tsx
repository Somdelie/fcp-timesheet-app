"use client";

import dynamic from "next/dynamic";
import { LeftSidebar } from "./Sidebar";

const WorkspaceCanvas = dynamic(() => import("./Canvas").then(mod => mod.WorkspaceCanvas), {
  ssr: false,
  loading: () => <div className="flex h-full w-full items-center justify-center bg-white">Loading Canvas...</div>
});

export function WorkspaceShell() {
  return (
    <div className="flex h-[calc(100vh-9rem)] w-full workspace-bg">
      <LeftSidebar />
      <div className="h-full min-w-0 flex-1 overflow-hidden">
        <WorkspaceCanvas />
      </div>
    </div>
  );
}
