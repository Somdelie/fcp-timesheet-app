"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "../ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "../ui/breadcrumb";
import { signOut } from "next-auth/react";
import { ModeToggle } from "./ModeToggle";

// Map of path segments to display labels
const pathLabels: Record<string, string> = {
  admin: "Admin",
  employees: "Employees",
  foreman: "Foremen",
  sites: "Sites",
  timesheets: "Timesheets",
  users: "Users",
  settings: "Settings",
  profile: "Profile",
  supervisor: "Supervisor",
  new: "New",
  map: "Map",
};

function formatSegment(segment: string): string {
  // Check if we have a custom label
  if (pathLabels[segment.toLowerCase()]) {
    return pathLabels[segment.toLowerCase()];
  }
  // Capitalize first letter for unknown segments
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

type NavbarProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  role: string;
};

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, role }) => {
  const pathname = usePathname();

  // Generate breadcrumbs from pathname
  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);

    // Always start with Dashboard
    const crumbs: { label: string; href?: string }[] = [
      { label: "Dashboard", href: "/" },
    ];

    // Build path progressively
    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const isLast = index === segments.length - 1;
      crumbs.push({
        label: formatSegment(segment),
        href: isLast ? undefined : currentPath,
      });
    });

    return crumbs;
  }, [pathname]);

  return (
    <header className="navbar flex h-16 shrink-0 w-full items-center justify-between border-b bg-card/80 px-4 backdrop-blur z-10">
      {/* left */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
          <Menu className="h-5 w-5" />
        </Button>
      </div>
      {/* center */}
      <div className="flex-1 px-4">
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={index}>
                <BreadcrumbItem>
                  {crumb.href ? (
                    <BreadcrumbLink href={crumb.href} className="text-sm">
                      {crumb.label}
                    </BreadcrumbLink>
                  ) : (
                    <BreadcrumbPage className="text-sm">
                      {crumb.label}
                    </BreadcrumbPage>
                  )}
                </BreadcrumbItem>
                {index < breadcrumbs.length - 1 && <BreadcrumbSeparator />}
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {/* right */}
      <div className="flex items-center gap-4">
        <ModeToggle />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Avatar size="lg">
              <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
              <AvatarFallback>{"user".charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="mr-4">
            <DropdownMenuGroup>
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem>
                Profile
                <DropdownMenuShortcut>⇧⌘P</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                Settings
                <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem
                className="bg-destructive rounded"
                onClick={() => signOut({ callbackUrl: "/login" })}
              >
                Sign out
                <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
              </DropdownMenuItem>
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default Navbar;
