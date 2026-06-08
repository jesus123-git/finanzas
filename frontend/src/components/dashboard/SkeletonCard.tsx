// Skeletons de carga — imitan la forma exacta de cada componente real
// para evitar layout shift (CLS) mientras se cargan los datos.
// Todas las clases tienen variantes dark: para que sean visibles en modo noche.

export function SkeletonCard() {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-6 shadow-sm animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-28" />
        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
      </div>
      <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-36 mb-2" />
      <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-20" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-3.5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 bg-slate-200 dark:bg-slate-700 rounded-xl flex-shrink-0" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-40" />
          <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-24" />
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-20" />
        <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-14" />
      </div>
    </div>
  );
}

export function SkeletonAccount() {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl animate-pulse">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 bg-slate-200 dark:bg-slate-700 rounded-xl" />
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-slate-200 dark:bg-slate-700 rounded w-32" />
          <div className="h-3 bg-slate-100 dark:bg-slate-700/50 rounded w-20" />
        </div>
      </div>
      <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24" />
    </div>
  );
}
