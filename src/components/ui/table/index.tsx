import type { ReactNode } from "react";
import type { SortDescriptor } from "@/hooks/use-table-sort";

import { cn } from "@/utils";

// Props for Table
interface TableProps {
  children: ReactNode; // Table content (thead, tbody, etc.)
  className?: string; // Optional className for styling
}

// Props for TableHeader
interface TableHeaderProps {
  children: ReactNode; // Header row(s)
  className?: string; // Optional className for styling
}

// Props for TableBody
interface TableBodyProps {
  children: ReactNode; // Body row(s)
  className?: string; // Optional className for styling
}

// Props for TableRow
interface TableRowProps {
  children: ReactNode; // Cells (th or td)
  className?: string; // Optional className for styling
  onClick?: () => void;
}

// Props for TableCell
interface TableCellProps {
  children?: ReactNode; // Cell content
  isHeader?: boolean; // If true, renders as <th>, otherwise <td>
  className?: string; // Optional className for styling
  colSpan?: number;
}

// Table Component
const Table: React.FC<TableProps> = ({ children, className }) => {
  return <table className={cn("min-w-full", className)}>{children}</table>;
};

// TableHeader Component
const TableHeader: React.FC<TableHeaderProps> = ({ children, className }) => {
  return <thead className={className}>{children}</thead>;
};

// TableBody Component
const TableBody: React.FC<TableBodyProps> = ({ children, className }) => {
  return <tbody className={className}>{children}</tbody>;
};

// TableRow Component
const TableRow: React.FC<TableRowProps> = ({ children, className, onClick }) => {
  return (
    <tr className={cn(onClick && "cursor-pointer", className)} onClick={onClick}>
      {children}
    </tr>
  );
};

// TableCell Component
const TableCell: React.FC<TableCellProps> = ({
  children,
  isHeader = false,
  className,
  colSpan,
}) => {
  const CellTag = isHeader ? "th" : "td";
  return (
    <CellTag className={cn(className)} colSpan={colSpan}>
      {children}
    </CellTag>
  );
};

// Clickable header cell for useTableSort: cycles ascending -> descending.
const TableSortHeader: React.FC<{
  column: string;
  sort?: SortDescriptor;
  onSortChange: (sort: SortDescriptor) => void;
  children: ReactNode;
  className?: string;
}> = ({ column, sort, onSortChange, children, className }) => {
  const active = sort?.column === column;
  const next = active && sort.direction === "ascending" ? "descending" : "ascending";
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSortChange({ column, direction: next })}
        className="inline-flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
      >
        {children}
        <span className={cn("text-[10px]", !active && "opacity-30")}>
          {active && sort.direction === "descending" ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
};

export { Table, TableBody, TableCell, TableHeader, TableRow, TableSortHeader };
