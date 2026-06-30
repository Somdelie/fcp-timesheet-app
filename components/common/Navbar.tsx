"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "../ui/button";
import { NotificationSheet } from "./NotificationSheet";
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
import { NavbarCalendar } from "./NavbarCalendar";

// Map of path segments to display labels
const pathLabels: Record<string, string> = {
  admin: "Admin",
  employees: "Employees",
  foreman: "Foremen",
  sites: "Sites",
  timesheets: "Timesheets",
  users: "Users",
  settings: "Settings",
  trash: "Trash",
  profile: "Profile",
  supervisor: "Supervisor",
  new: "New",
  map: "Map",
};

function formatSegment(segment: string): string {
  if (pathLabels[segment.toLowerCase()]) {
    return pathLabels[segment.toLowerCase()];
  }
  return segment.charAt(0).toUpperCase() + segment.slice(1);
}

type NavbarProps = {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  role: string;
};

const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar, role }) => {
  const pathname = usePathname();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const breadcrumbs = React.useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);

    const crumbs: { label: string; href?: string }[] = [
      { label: "Dashboard", href: "/" },
    ];

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

  if (!mounted) {
    return (
      <header className="navbar z-10 flex h-16 w-full shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onToggleSidebar}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <div className="flex-1 px-4" />
        <div className="h-8 w-40" />
      </header>
    );
  }

  return (
    <header className="navbar z-10 flex h-16 w-full shrink-0 items-center justify-between border-b bg-card/80 px-4 backdrop-blur">
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
        {role === "ADMIN" ? (
          <Button variant="ghost" size="icon" asChild title="Trash" className="bg-transparent hover:bg-transparent">
            <Link
              href="/admin/trash"
              aria-label="Open trash"
              className="group relative transition-transform duration-300 ease-out hover:-translate-y-0.5 hover:scale-110 active:translate-y-0 active:scale-95"
            >
              <img
                src="/trash/bin-closed.png"
                alt=""
                className="h-7 w-7 object-contain transition-all duration-300 ease-out group-hover:rotate-[-6deg] group-hover:opacity-0 group-hover:blur-[1px]"
              />
              <img
                src="/trash/bin-open.png"
                alt=""
                className="absolute inset-0 h-7 w-7 rotate-6 scale-90 object-contain opacity-0 transition-all duration-300 ease-out group-hover:rotate-0 group-hover:scale-100 group-hover:opacity-100"
              />
            </Link>
          </Button>
        ) : null}
        <NavbarCalendar />
        <NotificationSheet />
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
                className="rounded bg-destructive"
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
