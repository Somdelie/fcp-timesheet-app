import { WorkspaceCanvas } from "./Canvas";
import { LeftSidebar } from "./Sidebar";

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
