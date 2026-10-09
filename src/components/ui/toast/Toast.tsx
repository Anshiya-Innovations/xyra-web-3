import { useEffect, useState } from "react";
import Alert from "@/components/ui/alert/Alert";

type ToastType = "success" | "error" | "warning";
type ToastItem = { id: number; type: ToastType; message: string };

const TITLES: Record<ToastType, string> = { success: "Success", error: "Error", warning: "Warning" };

// Module-level queue so notify() works from anywhere (pages, lib/mock-data.ts)
// without a provider. Same signature as xyra-react's notify().
let items: ToastItem[] = [];
let nextId = 0;
const listeners = new Set<(items: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

export function notify(type: ToastType, message: string) {
  const id = nextId++;
  items = [...items, { id, type, message }].slice(-3);
  emit();
  setTimeout(() => {
    items = items.filter((t) => t.id !== id);
    emit();
  }, 5000);
}

// Mounted once in AppLayout and on the login page.
export function ToastRegion() {
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  return (
    <div className="fixed right-4 bottom-4 z-999999 flex w-80 flex-col gap-2">
      {list.map((t) => (
        <div key={t.id} className="rounded-xl bg-white shadow-theme-lg dark:bg-gray-900">
          <Alert variant={t.type} title={TITLES[t.type]} message={t.message} />
        </div>
      ))}
    </div>
  );
}
