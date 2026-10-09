import { type NotificationEntry, notificationApi } from "@/lib/api-client";
import { getSession } from "@/lib/session";
import { cn } from "@/utils";
import { AlertTriangle, Bell01, Check, CheckCircle, Clock, LogIn03, Settings01, Trash01 } from "@untitledui/icons";
import type { FC } from "react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Dropdown } from "../ui/dropdown/Dropdown";

// xyra-web's UI5 route names (see notify() call sites across xyra-core) ->
// this app's actual paths. SystemHealth folded into Configuration's Health tab.
const TARGET_PAGE_ROUTES: Record<string, string> = {
  DeviationReport: "/deviation-report",
  Reviewer1: "/reviewer-1",
  Reviewer2: "/reviewer-2",
  Configuration: "/configuration",
  SystemHealth: "/configuration",
  Profile: "/profile",
  SystemControlConfig: "/system-control-config",
};

// Colored by what kind of thing happened, not by the backend's iconClass
// (that colors by business outcome, which made every ALERT/TICKET red).
const CATEGORY_META: Record<string, { circle: string; icon: FC<{ className?: string }> }> = {
  ALERT: { circle: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500", icon: AlertTriangle },
  TICKET: { circle: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500", icon: CheckCircle },
  TASK: { circle: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400", icon: LogIn03 },
  REMINDER: { circle: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400", icon: Clock },
  CONFIG: { circle: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400", icon: Settings01 },
};
const DEFAULT_META = { circle: "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400", icon: Bell01 };

// Reviewer1/Reviewer2 are both the REVIEWER role, so filtering on role alone
// covers both. Escalation Manager/Auditor see everything - matches xyra-web's
// NotificationService.js. CONFIG is an admin concern only.
const VISIBLE_CATEGORIES_BY_ROLE: Record<string, Set<string>> = {
  REVIEWER: new Set(["ALERT", "TICKET"]),
  ADMIN: new Set(["ALERT", "TICKET", "CONFIG"]),
};

function filterForRole(notifications: NotificationEntry[], role: string | undefined): NotificationEntry[] {
  const visible = role ? VISIBLE_CATEGORIES_BY_ROLE[role] : undefined;
  return visible ? notifications.filter((n) => visible.has(n.category)) : notifications;
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} min ago`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} ${hour === 1 ? "hour" : "hours"} ago`;
  const day = Math.floor(hour / 24);
  if (day === 1) return "Yesterday";
  return `${day} days ago`;
}

const POLL_INTERVAL_MS = 20000;
type Tab = "ALL" | "TICKET" | "ALERT";
const TAB_LABEL: Record<Tab, string> = { ALL: "All", TICKET: "Ticket", ALERT: "Control Execution" };

export default function NotificationDropdown() {
  const navigate = useNavigate();
  const session = getSession();
  const [items, setItems] = useState<NotificationEntry[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("ALL");
  const [isOpen, setIsOpen] = useState(false);

  const load = () => {
    notificationApi
      .list()
      .then((res) => {
        if (!res.success) return;
        setItems(filterForRole(res.notifications, session?.role).filter((n) => !n.read));
      })
      .catch(() => {});
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markAsRead = (id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
    notificationApi.markAsRead(id).catch(() => {});
  };

  const clearAll = () => {
    setItems([]);
    notificationApi.clearAll().catch(() => {});
  };

  const onItemClick = (item: NotificationEntry) => {
    markAsRead(item.id);
    setIsOpen(false);
    const route = item.targetPage ? TARGET_PAGE_ROUTES[item.targetPage] : null;
    if (route) navigate(route);
  };

  const displayedItems = activeTab === "ALL" ? items : items.filter((n) => n.category === activeTab);

  return (
    <div className="relative">
      <button
        aria-label="Notifications"
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={() => setIsOpen((prev) => !prev)}
      >
        {items.length > 0 && (
          <span className="absolute -top-0.5 -right-0.5 z-10 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-error-500 px-1 text-[10px] leading-none font-semibold text-white">
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
        <Bell01 className="size-5" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        className="absolute -inset-s-13.5 mt-4.25 flex max-h-120 w-87.5 flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg sm:w-105 xl:inset-s-auto xl:inset-e-0 dark:border-gray-800 dark:bg-gray-dark"
      >
        <div className="mb-3 flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Notifications</h5>
            {items.length > 0 && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-theme-xs font-medium text-brand-500 dark:bg-brand-500/15 dark:text-brand-400">
                {items.length} New
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={clearAll}
            disabled={items.length === 0}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-error-500 hover:text-error-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash01 className="size-4" />
            Clear All
          </button>
        </div>

        <div className="mb-2 flex items-center gap-1">
          {(["ALL", "TICKET", "ALERT"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition",
                activeTab === tab
                  ? "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400"
                  : "text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/5",
              )}
            >
              {TAB_LABEL[tab]}
            </button>
          ))}
        </div>

        <ul className="custom-scrollbar flex flex-col overflow-y-auto">
          {displayedItems.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">No new notifications.</li>
          ) : (
            displayedItems.map((item) => {
              const meta = CATEGORY_META[item.category] ?? DEFAULT_META;
              const Icon = meta.icon;
              return (
                <li
                  key={item.id}
                  className="flex items-start gap-3 border-b border-gray-100 px-3 py-3 last:border-0 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5"
                >
                  <button type="button" onClick={() => onItemClick(item)} className="flex flex-1 items-start gap-3 text-start">
                    <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", meta.circle)}>
                      <Icon className="size-5" />
                    </span>
                    <span className="block min-w-0">
                      <span className="mb-1.5 block text-theme-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-white/90">{item.title}</span> — {item.message}
                      </span>
                      <span className="block text-theme-xs text-gray-500 uppercase dark:text-gray-400">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    title="Mark as read"
                    onClick={() => markAsRead(item.id)}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-gray-200"
                  >
                    <Check className="size-4" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </Dropdown>
    </div>
  );
}
