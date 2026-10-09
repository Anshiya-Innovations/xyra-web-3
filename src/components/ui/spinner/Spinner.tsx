export default function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-10">
      <span className="size-8 animate-spin rounded-full border-3 border-gray-200 border-t-brand-500 dark:border-gray-800 dark:border-t-brand-500" />
      {label && <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>}
    </div>
  );
}
