"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Inbox,
  Boxes,
  Package,
  Grid3x3,
  Users,
  CalendarDays,
  BarChart3,
  Settings,
  ArrowLeft,
  LogOut,
} from "lucide-react";
import { useAdminData } from "@/context/AdminDataContext";
import { StudioLogo } from "@/components/common/StudioLogo";
import { STUDIO_CONFIG } from "@/data/firangi";

export const adminLinks = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/enquiries", label: "Enquiries & WhatsApp", icon: Inbox, alias: "/admin/rental-requests", badgeKey: "enquiries" },
  { to: "/admin/inventory", label: "Physical Inventory", icon: Boxes, badgeKey: "inventory" },
  { to: "/admin/props", label: "Props Catalogue", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Grid3x3 },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

export const AdminSidebar = ({ onNavigate }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { lowStockCount, enquiries, waConversations } = useAdminData();

  const unreadEnquiriesTotal = useMemo(() => {
    const unreadWeb = enquiries.filter((e) => e.unread || e.status === "new").length;
    const unreadWA = waConversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
    return unreadWeb + unreadWA;
  }, [enquiries, waConversations]);

  const mainSiteUrl = process.env.NEXT_PUBLIC_MAIN_SITE_URL || "/";

  const logout = () => {
    if (onNavigate) onNavigate();
    toast("Signed out", { description: "You have been logged out of the admin panel." });
    if (mainSiteUrl.startsWith("http")) {
      window.location.href = mainSiteUrl;
    } else {
      router.push(mainSiteUrl);
    }
  };

  return (
    <aside className="aside on-dark h-full" style={{ display: "flex", flexDirection: "column" }} aria-label="Admin navigation">
      <div style={{ padding: "0 12px" }}>
        <Link href="/admin" className="inline-block py-1" title="Admin Dashboard">
          <StudioLogo dark={true} size="sm" />
        </Link>
      </div>

      <p className="aside-label">Admin Platform</p>

      <nav className="aside-nav" style={{ flex: 1, overflowY: "auto" }}>
        {adminLinks.map((l) => {
          const isActive = l.end
            ? pathname === l.to
            : pathname.startsWith(l.to) || (l.alias && pathname.startsWith(l.alias));

          const badgeCount =
            l.badgeKey === "enquiries"
              ? unreadEnquiriesTotal
              : l.badgeKey === "inventory"
              ? lowStockCount
              : 0;

          return (
            <Link
              key={l.to}
              href={l.to}
              onClick={onNavigate}
              className={`aside-link ${isActive ? "is-active" : ""}`}
              aria-current={isActive ? "page" : undefined}
            >
              <l.icon className="ic" strokeWidth={1.7} />
              <span style={{ flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {l.label}
              </span>
              {badgeCount > 0 && (
                <span
                  style={{
                    marginLeft: "auto",
                    padding: "2px 7px",
                    borderRadius: "10px",
                    fontSize: "11px",
                    fontWeight: 700,
                    background: isActive ? "#050505" : "#FED508",
                    color: isActive ? "#FED508" : "#050505",
                  }}
                >
                  {badgeCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="aside-foot">
        <div style={{ display: "flex", gap: "12px", alignItems: "center", padding: "0 12px" }}>
          <span className="avatar flex items-center justify-center p-1 bg-white/10" aria-hidden="true"><img src="/images/frangipani-flower.svg" alt="" style={{ width: "22px", height: "22px", objectFit: "contain" }} /></span>
          <div style={{ minWidth: 0 }}>
            <p style={{ fontSize: "14px", fontWeight: 500, color: "#FFFFFF" }}>{STUDIO_CONFIG.name}</p>
            <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.7)", overflow: "hidden", textOverflow: "ellipsis" }}>
              {STUDIO_CONFIG.adminEmail || STUDIO_CONFIG.email}
            </p>
          </div>
        </div>

        {mainSiteUrl.startsWith("http") ? (
          <a href={mainSiteUrl} className="aside-link" title="Open Main Website">
            <ArrowLeft className="ic" strokeWidth={1.7} />
            <span>Back to site</span>
          </a>
        ) : (
          <Link href="/" onClick={onNavigate} className="aside-link">
            <ArrowLeft className="ic" strokeWidth={1.7} />
            <span>Back to site</span>
          </Link>
        )}

        <button
          type="button"
          onClick={logout}
          className="aside-link"
          style={{ width: "100%", background: "none", border: 0, cursor: "pointer", textAlign: "left" }}
        >
          <LogOut className="ic" strokeWidth={1.7} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
};
