import { ToastRegion } from "@/components/ui/toast/Toast";
import { SidebarProvider, useSidebar } from "@/context/SidebarContext";
import { cn } from "@/utils";
import { Outlet } from "react-router";
import AppHeader from "./AppHeader";
import AppSidebar from "./AppSidebar";
import Backdrop from "./Backdrop";

const LayoutContent: React.FC<{ hideSidebar: boolean }> = ({ hideSidebar }) => {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();

  return (
    <div className="min-h-screen xl:flex">
      {!hideSidebar && (
        <>
          <AppSidebar />
          <Backdrop />
        </>
      )}

      <div
        className={cn(
          "min-w-0 flex-1 transition-[margin] duration-300 ease-in-out",
          !hideSidebar && (isExpanded || isHovered ? "xl:ms-72.5" : "xl:ms-22.5"),
          isMobileOpen ? "ms-0" : "",
        )}
      >
        <AppHeader hideSidebar={hideSidebar} />
        <main className="mx-auto max-w-(--breakpoint-2xl) p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <ToastRegion />
    </div>
  );
};

const AppLayout: React.FC<{ hideSidebar?: boolean }> = ({ hideSidebar = false }) => {
  return (
    <SidebarProvider>
      <LayoutContent hideSidebar={hideSidebar} />
    </SidebarProvider>
  );
};

export default AppLayout;
