// Page-level building blocks shared by the ported xyra-react pages, all built
// on TailAdmin primitives/tokens so every page looks like the template.
import Label from "@/components/form/Label";
import Select from "@/components/form/Select";
import Input from "@/components/form/input/InputField";
import TextArea from "@/components/form/input/TextArea";
import Badge from "@/components/ui/badge/Badge";
import { Modal } from "@/components/ui/modal";
import Spinner from "@/components/ui/spinner/Spinner";
import { cn } from "@/utils";
import { ArrowLeft, Calendar, SearchLg, XClose } from "@untitledui/icons";
import flatpickr from "flatpickr";
import "flatpickr/dist/flatpickr.css";
import type { FC, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { Link } from "react-router";

// ---- Badge: keeps xyra-react's color names, mapped onto TailAdmin's palette.
export type BadgeColors =
  | "gray"
  | "brand"
  | "error"
  | "warning"
  | "success"
  | "blue"
  | "blue-light"
  | "indigo"
  | "purple"
  | "orange"
  | "pink"
  | "gray-blue";

const BADGE_MAP: Record<BadgeColors, "primary" | "success" | "error" | "warning" | "info" | "light" | "dark"> = {
  gray: "light",
  brand: "primary",
  error: "error",
  warning: "warning",
  success: "success",
  blue: "info",
  "blue-light": "info",
  indigo: "primary",
  purple: "primary",
  orange: "warning",
  pink: "error",
  "gray-blue": "light",
};

export function XBadge({ color = "gray", children }: { color?: BadgeColors; children: ReactNode }) {
  return (
    <Badge size="sm" color={BADGE_MAP[color] ?? "light"}>
      {children}
    </Badge>
  );
}

// ---- Page header: title + breadcrumb trail + optional description/back/actions.
export function PageHeader({
  title,
  description,
  crumbs = [],
  onBack,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  crumbs?: string[];
  onBack?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav>
          <ol className="flex flex-wrap items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
            <li>
              <Link to="/" className="hover:text-gray-700 dark:hover:text-gray-300">
                Home
              </Link>
            </li>
            {crumbs.map((c, i) => (
              <li key={c + i} className="flex items-center gap-1.5">
                <span>/</span>
                <span className={i === crumbs.length - 1 ? "text-gray-800 dark:text-white/90" : ""}>{c}</span>
              </li>
            ))}
          </ol>
        </nav>
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-1 inline-flex w-fit items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <ArrowLeft className="size-4" />
              Back
            </button>
          )}
          <h2 className="text-title-sm font-semibold text-gray-800 dark:text-white/90">{title}</h2>
          {description && <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}

export function ErrorBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-error-500/30 bg-error-50 px-4 py-3 text-sm text-error-600 dark:bg-error-500/15 dark:text-error-500">
      {children}
    </p>
  );
}

export function InfoBanner({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-lg border border-blue-light-500/30 bg-blue-light-50 px-4 py-3 text-sm text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-500">
      {children}
    </p>
  );
}

// ---- Cards
export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3", className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6 dark:border-gray-800">
          <div>
            {title && <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>}
            {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className={cn(title || actions ? "p-5 sm:p-6" : "p-5 sm:p-6", bodyClassName)}>{children}</div>
    </div>
  );
}

// Card whose body is a table (no body padding, horizontal scroll).
export function TableCard({
  title,
  count,
  description,
  actions,
  children,
  footer,
}: {
  title?: ReactNode;
  count?: number;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/3">
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 sm:px-6 dark:border-gray-800">
          <div>
            <div className="flex items-center gap-2">
              {title && <h3 className="text-base font-semibold text-gray-800 dark:text-white/90">{title}</h3>}
              {count !== undefined && <XBadge color="gray">{count}</XBadge>}
            </div>
            {description && <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </div>
      )}
      <div className="max-w-full overflow-x-auto">{children}</div>
      {footer && <div className="border-t border-gray-100 dark:border-gray-800">{footer}</div>}
    </div>
  );
}

// Table cell classes (TailAdmin BasicTableOne look).
export const TH = "px-5 py-3 text-start text-theme-xs font-medium whitespace-nowrap text-gray-500 dark:text-gray-400";
export const TD = "px-5 py-3.5 text-start text-theme-sm text-gray-500 dark:text-gray-400";
export const TD_STRONG = "px-5 py-3.5 text-start text-theme-sm font-medium text-gray-800 dark:text-white/90";
export const THEAD = "border-b border-gray-100 dark:border-white/5";
export const TBODY = "divide-y divide-gray-100 dark:divide-white/5";
export const TROW_HOVER = "hover:bg-gray-50 dark:hover:bg-white/2";

export function Loading({ label }: { label?: string }) {
  return (
    <div className="flex min-h-60 items-center justify-center">
      <Spinner label={label} />
    </div>
  );
}

// ---- Form fields (value-based onChange like xyra-react's inputs)
export function TextField({
  label,
  required,
  value,
  onChange,
  type = "text",
  placeholder,
  readOnly,
  disabled,
  hint,
  error,
  min,
  max,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  value: string | number;
  onChange?: (value: string) => void;
  type?: string;
  placeholder?: string;
  readOnly?: boolean;
  disabled?: boolean;
  hint?: string;
  error?: boolean;
  min?: string | number;
  max?: string | number;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label>
          {label} {required && <span className="text-error-500">*</span>}
        </Label>
      )}
      <Input
        type={type}
        value={value}
        placeholder={placeholder}
        readOnly={readOnly}
        disabled={disabled}
        hint={hint}
        error={error}
        min={min}
        max={max}
        className={readOnly ? "bg-gray-50 dark:bg-white/3" : ""}
        onChange={(e) => onChange?.(e.target.value)}
      />
    </div>
  );
}

export type Option = { value: string; label: string };

export function SelectField({
  label,
  required,
  value,
  onChange,
  options,
  placeholder = "Select an option",
  disabled,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label>
          {label} {required && <span className="text-error-500">*</span>}
        </Label>
      )}
      <Select value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} />
    </div>
  );
}

export function TextAreaField({
  label,
  required,
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
  hint,
  className,
}: {
  label?: ReactNode;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <Label>
          {label} {required && <span className="text-error-500">*</span>}
        </Label>
      )}
      <TextArea value={value} onChange={onChange} placeholder={placeholder ?? ""} rows={rows} disabled={disabled} hint={hint} />
    </div>
  );
}

// Read-only label/value pair for detail views.
export function DetailItem({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-theme-xs text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-sm font-medium text-gray-800 dark:text-white/90">{children || "—"}</span>
    </div>
  );
}

// Controlled on/off switch (TailAdmin's Switch look).
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("flex cursor-pointer items-start gap-3 select-none", disabled && "cursor-not-allowed opacity-50")}>
      <span className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className={cn("block h-6 w-11 rounded-full transition", checked ? "bg-brand-500" : "bg-gray-200 dark:bg-white/10")} />
        <span
          className={cn(
            "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow-theme-sm transition-transform",
            checked && "translate-x-5",
          )}
        />
      </span>
      {(label || hint) && (
        <span className="flex flex-col">
          {label && <span className="text-sm font-medium text-gray-700 dark:text-gray-400">{label}</span>}
          {hint && <span className="text-theme-xs text-gray-500 dark:text-gray-400">{hint}</span>}
        </span>
      )}
    </label>
  );
}

// ---- Icon-only button used in table rows.
export function IconButton({
  icon: Icon,
  title,
  onClick,
  danger,
  disabled,
}: {
  icon: FC<{ className?: string }>;
  title: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-200",
        danger && "hover:bg-error-50 hover:text-error-600 dark:hover:bg-error-500/15 dark:hover:text-error-500",
      )}
    >
      <Icon className="size-4" />
    </button>
  );
}

// ---- Dialog: TailAdmin Modal with title/body/footer layout.
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const width = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" }[size];
  return (
    <Modal isOpen={open} onClose={onClose} className={cn("m-4 p-6 sm:p-8", width)}>
      <div className="pe-10">
        <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h4>
        {description && <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{description}</p>}
      </div>
      {children && <div className="custom-scrollbar mt-5 max-h-[65vh] overflow-y-auto pe-1">{children}</div>}
      {footer && <div className="mt-6 flex flex-wrap justify-end gap-3">{footer}</div>}
    </Modal>
  );
}

// ---- Small KPI tile.
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "brand",
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: FC<{ className?: string }>;
  tone?: "brand" | "success" | "error" | "warning" | "gray";
}) {
  const toneClass = {
    brand: "bg-brand-50 text-brand-500 dark:bg-brand-500/15 dark:text-brand-400",
    success: "bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500",
    error: "bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-500",
    warning: "bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-orange-400",
    gray: "bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-gray-300",
  }[tone];
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      {Icon && (
        <div className={cn("mb-4 flex size-11 items-center justify-center rounded-xl", toneClass)}>
          <Icon className="size-5" />
        </div>
      )}
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <h4 className="mt-1 text-title-sm font-bold text-gray-800 dark:text-white/90">{value}</h4>
      {hint && <p className="mt-1 text-theme-xs text-gray-500 dark:text-gray-400">{hint}</p>}
    </div>
  );
}

// ["A","B"] -> [{value:"A",label:"A"}, ...]
export const opts = (values: readonly string[], label: (v: string) => string = (v) => v): Option[] =>
  values.map((v) => ({ value: v, label: label(v) }));

// Search box for table-card headers.
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative w-full sm:w-64", className)}>
      <SearchLg className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-lg border border-gray-300 bg-transparent py-2 pr-4 pl-10 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
      />
    </div>
  );
}

// ---- Date range (flatpickr), controlled: passing null clears it.
export type DateRange = { start: Date; end: Date };

// Local calendar date as YYYY-MM-DD (what react-aria's CalendarDate.toString() gave).
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export function DateRangeField({
  value,
  onChange,
  label,
  placeholder = "Select date range",
  className,
}: {
  value: DateRange | null;
  onChange: (range: DateRange | null) => void;
  label?: ReactNode;
  placeholder?: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<flatpickr.Instance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!inputRef.current) return;
    const fp = flatpickr(inputRef.current, {
      mode: "range",
      dateFormat: "Y-m-d",
      monthSelectorType: "static",
      onChange: (dates) => {
        if (dates.length === 2) onChangeRef.current({ start: dates[0], end: dates[1] });
        else if (dates.length === 0) onChangeRef.current(null);
      },
    });
    fpRef.current = fp;
    return () => fp.destroy();
  }, []);

  // Sync external value (e.g. "Clear filters" setting it to null).
  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    if (!value) {
      if (fp.selectedDates.length) fp.clear(false);
    } else if (
      fp.selectedDates.length !== 2 ||
      fp.selectedDates[0].getTime() !== value.start.getTime() ||
      fp.selectedDates[1].getTime() !== value.end.getTime()
    ) {
      fp.setDate([value.start, value.end], false);
    }
  }, [value]);

  return (
    <div className={className}>
      {label && <Label>{label}</Label>}
      <div className="relative">
        <input
          ref={inputRef}
          placeholder={placeholder}
          readOnly
          className="h-11 w-full min-w-56 appearance-none rounded-lg border border-gray-300 bg-transparent py-2.5 ps-4 pe-10 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/20 focus:outline-hidden dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />
        {value ? (
          <button
            type="button"
            title="Clear dates"
            onClick={() => {
              fpRef.current?.clear(false);
              onChange(null);
            }}
            className="absolute top-1/2 right-3 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
          >
            <XClose className="size-4" />
          </button>
        ) : (
          <Calendar className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
        )}
      </div>
    </div>
  );
}

// Read-only multi-line value (replaces read-only TextAreas in detail dialogs).
export function ReadonlyText({ label, value }: { label: ReactNode; value?: string | null }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="max-h-48 min-h-11 overflow-y-auto rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm break-words whitespace-pre-wrap text-gray-800 dark:border-gray-800 dark:bg-white/3 dark:text-white/90">
        {value || "—"}
      </div>
    </div>
  );
}

// Label / big number / hint-badge tile (KPI rows).
export function KpiTile({
  label,
  value,
  hint,
  color = "gray",
  onClick,
  active,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  color?: BadgeColors;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 rounded-2xl border bg-white p-5 text-left dark:bg-white/3",
        active ? "border-brand-500 ring-2 ring-brand-500/20" : "border-gray-200 dark:border-gray-800",
        onClick && !active && "transition hover:border-gray-300 dark:hover:border-gray-700",
      )}
    >
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className="text-title-sm font-bold text-gray-800 dark:text-white/90">{value}</span>
      {hint && <XBadge color={color}>{hint}</XBadge>}
    </Tag>
  );
}

const COUNT_TEXT: Partial<Record<BadgeColors, string>> = {
  brand: "text-brand-500 dark:text-brand-400",
  error: "text-error-600 dark:text-error-500",
  warning: "text-warning-600 dark:text-orange-400",
  success: "text-success-600 dark:text-success-500",
};

// Label + big colored number (queue/history counters).
export function CountTile({ label, value, color = "gray" }: { label: ReactNode; value: ReactNode; color?: BadgeColors }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/3">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={cn("text-title-sm font-bold", COUNT_TEXT[color] ?? "text-gray-800 dark:text-white/90")}>{value}</span>
    </div>
  );
}
