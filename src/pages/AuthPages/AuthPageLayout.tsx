import ProjectFlowIllustration from "@/components/illustrations/ProjectFlowIllustration";
import ThemeTogglerTwo from "@/components/common/ThemeTogglerTwo";
import React from "react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative z-1 bg-white p-6 sm:p-0 dark:bg-gray-900">
      <div className="relative flex h-screen w-full flex-col justify-center sm:p-0 lg:flex-row dark:bg-gray-900 overflow-hidden">
        {children}
        <div className="hidden h-full w-full lg:flex lg:w-1/2">
          <ProjectFlowIllustration />
        </div>

        <div className="fixed inset-e-6 bottom-6 z-50 hidden sm:block">
          <ThemeTogglerTwo />
        </div>
      </div>
    </div>
  );
}
