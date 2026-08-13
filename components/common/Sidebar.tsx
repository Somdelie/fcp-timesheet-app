"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Settings,
  Building2,
  NotebookIcon,
  MapPin,
  Camera,
  ScanLine,
  Package,
  ShoppingCart,
  LayoutDashboard,
  UserPlus,
  ArrowRightLeft,
  ChevronRight,
  Truck,
  FolderTree,
  DollarSign,
  Shield,
  Clock,
  ClipboardList,
  Paintbrush,
  Palette,
  CalendarDays,
  StickyNote,
  CloudSun,
  Printer,
  TrendingUp,
  Wrench,
  HardHat,
  UserCog,
  Boxes,
  Warehouse,
  ShoppingBag,
  Tag,
  Hammer,
  Archive,
  BadgeMinus,
  Trash2,
  ScanFace,
} from "lucide-react";

type Role = "ADMIN" | "OFFICE" | "SUPERVISOR" | "FOREMAN";

type SidebarProps = {
  isOpen: boolean;
  isOverlay?: boolean;
  role: Role;
  userName: string;
};

function icon3d(name: string) {
  return `/icons-3d/${encodeURIComponent(name)}.png`;
}

const menuGroups: {
  group: string;
  items: {
    href: string;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    iconSrc?: string;
    roles: Role[];
  }[];
}[] = [
  {
    group: "Overview",
    items: [
      {
        href: "/dashboard",
        label: "Dashboard",
        icon: LayoutDashboard,
        iconSrc: icon3d("Dashboard"),
        roles: ["ADMIN", "OFFICE", "SUPERVISOR", "FOREMAN"],
      },
      {
        href: "/overview",
        label: "Overview",
        icon: CalendarDays,
        iconSrc: icon3d("Overview"),
        roles: ["ADMIN", "OFFICE", "FOREMAN"],
      },
    ],
  },
  {
    group: "Payroll",
    items: [
      {
        href: "/timesheets",
        label: "Timesheets",
        icon: NotebookIcon,
        iconSrc: icon3d("Timesheets"),
        roles: ["ADMIN"],
      },
      {
        href: "/admin/payroll",
        label: "Payroll",
        icon: Clock,
        iconSrc: icon3d("Payroll"),
        roles: ["ADMIN"],
      },
      {
        href: "/supervisor/timesheets",
        label: "Manage Timesheets",
        icon: NotebookIcon,
        iconSrc: icon3d("Timesheets"),
        roles: ["SUPERVISOR"],
      },
    ],
  },
  {
    group: "Sites & Operations",
    items: [
      {
        href: "/sites",
        label: "Sites",
        icon: Building2,
        iconSrc: icon3d("Sites"),
        roles: ["ADMIN", "OFFICE", "SUPERVISOR", "FOREMAN"],
      },
      {
        href: "/admin/sites-operations",
        label: "Sites Operations",
        icon: TrendingUp,
        iconSrc: icon3d("Sites Operations"),
        roles: ["ADMIN", "OFFICE"],
      },
      {
        href: "/supervisor/job-progress",
        label: "Job Progress",
        icon: TrendingUp,
        iconSrc: icon3d("Sites Operations"),
        roles: ["SUPERVISOR"],
      },
      {
        href: "/supervisor/photos",
        label: "Photo Verification",
        icon: Camera,
        roles: ["SUPERVISOR"],
      },
    ],
  },
  {
    group: "Procurement",
    items: [
      {
        href: "/admin/paints&preperations",
        label: "Paints & Preparations",
        icon: Truck,
        iconSrc: icon3d("Paints & Preparations"),
        roles: ["ADMIN", "OFFICE"],
      },
      {
        href: "/admin/suppliers",
        label: "Suppliers & Categories",
        icon: Tag,
        iconSrc: icon3d("Suppliers & Categories"),
        roles: ["ADMIN", "OFFICE"],
      },
      {
        href: "/admin/paints-colors",
        label: "Paint Colors & Bases",
        icon: Palette,
        iconSrc: icon3d("Paint Colors & Bases"),
        roles: ["ADMIN", "OFFICE"],
      },
      {
        href: "/admin/equipment",
        label: "Equipment Catalogue",
        icon: Wrench,
        iconSrc: icon3d("Equipment Catalogue"),
        roles: ["ADMIN", "OFFICE"],
      },
      {
        href: "/admin/orders",
        label: "Orders Catalogue",
        icon: ShoppingCart,
        iconSrc: icon3d("Orders Catalogue"),
        roles: ["ADMIN", "OFFICE"],
      },
    ],
  },
  {
    group: "People & Attendance",
    items: [
      {
        href: "/admin/people",
        label: "People",
        icon: Users,
        iconSrc: icon3d("People"),
        roles: ["ADMIN"],
      },
      {
        href: "/admin/print-cards",
        label: "Print Cards",
        icon: Printer,
        iconSrc: icon3d("Print Cards"),
        roles: ["ADMIN"],
      },
      {
        href: "/admin/attendance?tab=analytics",
        label: "Attendance",
        icon: ScanLine,
        iconSrc: icon3d("Attendance"),
        roles: ["ADMIN"],
      },
      {
        href: "/admin/face-verifications",
        label: "Face Verifications",
        icon: ScanFace,
        roles: ["ADMIN"],
      },
      {
        href: "/employees",
        label: "Employees",
        icon: Users,
        iconSrc: icon3d("People"),
        roles: ["SUPERVISOR", "FOREMAN"],
      },
      {
        href: "/supervisor/foremen",
        label: "Foremen",
        icon: HardHat,
        iconSrc: icon3d("People"),
        roles: ["SUPERVISOR"],
      },
    ],
  },

  {
    group: "System",
    items: [
      {
        href: "/settings",
        label: "Settings",
        icon: Settings,
        iconSrc: icon3d("Settings"),
        roles: ["ADMIN"],
      },
      {
        href: "/admin/trash",
        label: "Trash",
        icon: Trash2,
        iconSrc: icon3d("Trash"),
        roles: ["ADMIN"],
      },
    ],
  },
];

const roleBadgeConfig: Record<Role, { label: string; color: string }> = {
  ADMIN: { label: "Admin", color: "#e8572a" },
  OFFICE: { label: "Office", color: "#9333ea" },
  SUPERVISOR: { label: "Supervisor", color: "#2a7ae8" },
  FOREMAN: { label: "Foreman", color: "#2ae87a" },
};

const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isOverlay = false,
  role,
  userName,
}) => {
  const pathname = usePathname();
  const badge = roleBadgeConfig[role];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700&display=swap');

        .sidebar-root {
          font-family: 'DM Sans', sans-serif;
          background-color: color-mix(in oklab, var(--card) 80%, transparent);
          color: var(--card-foreground);
          display: flex;
          flex-direction: column;
          height: 100%;
          border-right: 1px solid var(--border);
          transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
          overflow: hidden;
          position: relative;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 16px;
          height: 64px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.08);
          flex-shrink: 0;
          background: #ffffff;
        }

        .sidebar-logo-mark {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .sidebar-role-badge {
          margin: 12px 12px 4px;
          border-radius: 3px;
          padding: 5px 12px;
          background: color-mix(in oklab, var(--muted) 50%, transparent);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          overflow: hidden;
          transition: all 250ms ease;
        }

        .sidebar-role-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          flex-shrink: 0;
          position: relative;
        }

        .sidebar-role-dot::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: inherit;
          opacity: 0.25;
        }

        .sidebar-role-info {
          overflow: hidden;
          transition: all 250ms ease;
        }

        .sidebar-role-label {
          font-size: 10px;
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: var(--muted-foreground);
          line-height: 1;
          margin-bottom: 2px;
        }

        .sidebar-role-name {
          font-size: 13px;
          font-weight: 600;
          color: var(--foreground);
          line-height: 1;
          white-space: nowrap;
        }

        .sidebar-nav {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 0 16px;
          scrollbar-width: thin;
          scrollbar-color: var(--border) transparent;
        }

        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }

        .sidebar-nav::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-nav::-webkit-scrollbar-thumb {
          background: var(--border);
          border-radius: 2px;
        }

        .sidebar-group {
          margin-bottom: 4px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--border);
        }

        .sidebar-group-label {
          font-size: 10px;
          font-weight: 600;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted-foreground);
          padding: 12px 16px 4px;
          white-space: nowrap;
          overflow: hidden;
          transition: all 250ms ease;
        }

        .sidebar-item {
          display: flex;
          align-items: center;
          gap: 4px;
          margin: 1px 8px;
          padding: 4px 10px;
          border-radius: 2px;
          text-decoration: none;
          color: var(--muted-foreground);
          font-size: 13.5px;
          font-weight: 500;
          transition: all 180ms ease;
          position: relative;
          white-space: nowrap;
          overflow: hidden;
        }

        .sidebar-item:hover {
          background: color-mix(in oklab, var(--muted) 50%, transparent);
          color: var(--foreground);
        }

        .sidebar-item.active {
          background: color-mix(in srgb, var(--theme-primary, var(--primary)) 14%, transparent);
          color: var(--theme-primary, var(--primary));
        }

        .sidebar-item.active::before {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          transform: translateY(-50%);
          width: 3px;
          height: 60%;
          background: var(--theme-primary, var(--primary));
          border-radius: 0 2px 2px 0;
        }

        .sidebar-item-icon {
          width: 28px;
          height: 28px;
          flex-shrink: 0;
          transition: transform 220ms ease, filter 220ms ease;
        }

        .sidebar-item-icon-img {
          object-fit: contain;
          filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.18));
        }

        .sidebar-item:hover .sidebar-item-icon {
          transform: translateY(-1px) scale(1.12);
          filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.22));
        }

        .sidebar-item.active .sidebar-item-icon {
          transform: scale(1.08);
        }

        .sidebar-item-label {
          flex: 1;
          transition: opacity 200ms ease, transform 200ms ease;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .sidebar-item-arrow {
          opacity: 0;
          transform: translateX(-4px);
          transition: all 180ms ease;
          flex-shrink: 0;
          width: 12px;
          height: 12px;
        }

        .sidebar-item:hover .sidebar-item-arrow,
        .sidebar-item.active .sidebar-item-arrow {
          opacity: 0.6;
          transform: translateX(0);
        }

        .sidebar-divider {
          height: 1px;
          background: var(--border);
          margin: 8px 16px;
        }

        .sidebar-collapsed .sidebar-group-label,
        .sidebar-collapsed .sidebar-logo-text,
        .sidebar-collapsed .sidebar-role-info {
          opacity: 0;
          width: 0;
          pointer-events: none;
        }

        .sidebar-collapsed .sidebar-role-badge {
          justify-content: center;
          padding: 10px;
        }

        .sidebar-collapsed .sidebar-item {
          justify-content: center;
          padding: 9px;
          margin: 1px 8px;
        }

        .sidebar-collapsed .sidebar-item-label,
        .sidebar-collapsed .sidebar-item-arrow {
          opacity: 0;
          width: 0;
          overflow: hidden;
        }

        /* Overlay mode (mobile/tablet) */
        .sidebar-overlay {
          position: fixed;
          top: 0;
          left: 0;
          height: 100%;
          z-index: 50;
          box-shadow: 4px 0 24px rgba(0,0,0,0.18);
          transform: translateX(0);
          transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1),
                      transform 300ms cubic-bezier(0.4, 0, 0.2, 1),
                      box-shadow 300ms ease;
        }

        .sidebar-overlay.sidebar-collapsed {
          transform: translateX(-100%);
          box-shadow: none;
        }
      `}</style>

      <aside
        className={`sidebar-root ${isOverlay ? "sidebar-overlay" : ""} ${!isOpen ? "sidebar-collapsed" : ""}`}
        style={{ width: isOverlay ? 240 : isOpen ? 240 : 64 }}
      >
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo-mark">
            {isOpen ? (
              <img
                src="/logo.png"
                alt="Logo"
                style={{ height: 40, width: "auto" }}
              />
            ) : (
              <img
                src="/favicon.ico"
                alt="Logo"
                style={{ height: 32, width: 32 }}
              />
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {menuGroups.map((group, gi) => {
            const visibleItems = group.items.filter((item) =>
              item.roles.includes(role),
            );
            if (visibleItems.length === 0) return null;

            return (
              <div className="sidebar-group" key={group.group}>
                {gi > 0 && !isOpen && <div className="sidebar-divider" />}
                {isOpen && (
                  <div className="sidebar-group-label">{group.group}</div>
                )}
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={`sidebar-item ${isActive ? "active" : ""}`}
                      title={!isOpen ? item.label : undefined}
                    >
                      {item.iconSrc ? (
                        <img
                          src={item.iconSrc}
                          alt=""
                          className="sidebar-item-icon sidebar-item-icon-img"
                        />
                      ) : (
                        <Icon className="sidebar-item-icon" />
                      )}
                      {isOpen && (
                        <>
                          <span className="sidebar-item-label">
                            {item.label}
                          </span>
                          <ChevronRight className="sidebar-item-arrow" />
                        </>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Role Badge */}
        <div className="sidebar-role-badge" style={{ marginTop: "auto" }}>
          <div
            className="sidebar-role-dot"
            style={{ background: badge.color }}
          />
          {isOpen && (
            <div className="sidebar-role-info">
              <div className="sidebar-role-label">{badge.label}</div>
              <div className="sidebar-role-name">{userName}</div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
