"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Users,
  Settings,
  User2,
  Building2,
  NotebookIcon,
  MapPin,
  Camera,
  ScanLine,
  Package,
  ShoppingCart,
} from "lucide-react";

type Role = "ADMIN" | "SUPERVISOR" | "FOREMAN";

type SidebarProps = {
  isOpen: boolean;
  role: Role;
};

const menuItems: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: Role[];
}[] = [
  {
    href: "/",
    label: "Home",
    icon: Home,
    roles: ["ADMIN", "SUPERVISOR", "FOREMAN"],
  },
  {
    href: "/profile",
    label: "Profile",
    icon: User2,
    roles: ["ADMIN", "SUPERVISOR", "FOREMAN"],
  },
  {
    href: "/employees",
    label: "Employees",
    icon: Users,
    roles: ["ADMIN", "SUPERVISOR", "FOREMAN"],
  },
  {
    href: "/foreman",
    label: "Foremen",
    icon: Users,
    roles: ["ADMIN"],
  },
  {
    href: "/sites",
    label: "Sites",
    icon: Building2,
    roles: ["ADMIN", "SUPERVISOR", "FOREMAN"],
  },
  {
    href: "/products",
    label: "Products",
    icon: Package,
    roles: ["ADMIN"],
  },
  {
    href: "/orders",
    label: "Orders",
    icon: ShoppingCart,
    roles: ["ADMIN"],
  },
  {
    href: "/sites/map",
    label: "Sites Map",
    icon: MapPin,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/site-photos",
    label: "Photo Verifications",
    icon: Camera,
    roles: ["ADMIN"],
  },
  {
    href: "/admin/attendance-scans",
    label: "Attendance Scans",
    icon: ScanLine,
    roles: ["ADMIN"],
  },
  {
    href: "/timesheets",
    label: "Timesheets",
    icon: NotebookIcon,
    roles: ["ADMIN"],
  },
  {
    href: "/supervisor/timesheets",
    label: "Manage Timesheets",
    icon: NotebookIcon,
    roles: ["SUPERVISOR"],
  },
  {
    href: "/users",
    label: "User Management",
    icon: Users,
    roles: ["ADMIN"],
  },
  { href: "/settings", label: "Settings", icon: Settings, roles: ["ADMIN"] },
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, role }) => {
  const pathname = usePathname();

  return (
    <aside
      className={`flex h-full flex-col border-r bg-sidebar text-sidebar-foreground transition-all duration-300 ease-in-out ${
        isOpen ? "w-64" : "w-16"
      }`}
    >
      <div className="flex-1 overflow-hidden">
        {/* header with logo / icon */}
        <div className="mb-2 flex h-14 items-center justify-center border-b bg-white">
          {isOpen ? (
            <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          ) : (
            <img src="/favicon.ico" alt="Logo" className="h-8 w-8" />
          )}
        </div>
        {/* navigation */}
        <nav className="space-y-1 px-2">
          {menuItems
            .filter((item) => item.roles.includes(role))
            .map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium border-b pb-3 border-primary/30 transition-colors
                    ${
                      isActive
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                    }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span
                    className={`whitespace-nowrap transition-all duration-200 ease-in-out ${
                      isOpen
                        ? "opacity-100 translate-x-0"
                        : "opacity-0 -translate-x-2"
                    }`}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
        </nav>
      </div>
    </aside>
  );
};

export default Sidebar;
