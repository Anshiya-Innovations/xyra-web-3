import type { FC, ReactNode } from "react";

type Props = {
  icon?: FC<{ className?: string }>;
  title: string;
  description?: ReactNode;
  children?: ReactNode; // actions
};

export default function EmptyState({ icon: Icon, title, description, children }: Props) {
  return (
    <div className="flex flex-col items-center gap-4 px-4 py-10 text-center">
      {Icon && (
        <span className="flex size-12 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400">
          <Icon className="size-6" />
        </span>
      )}
      <div className="flex flex-col gap-1">
        <h4 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h4>
        {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {children && <div className="flex gap-3">{children}</div>}
    </div>
  );
}
