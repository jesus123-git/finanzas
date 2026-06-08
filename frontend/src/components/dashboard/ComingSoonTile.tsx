// ─── ComingSoonTile ────────────────────────────────────────────────────────────
//
// Tile placeholder reutilizable para features en construcción.
// Muestra el icono grande, el título, una descripción y la etapa en que llegará.
// Se estiliza con borde punteado para diferenciarlo visualmente de los tiles reales.

interface Props {
  icon:        string;
  title:       string;
  description: string;
  step:        string;        // "Etapa 2", "Etapa 3", etc.
  minHeight?:  string;        // ej. "min-h-[220px]" — por defecto 200px
}

export function ComingSoonTile({ icon, title, description, step, minHeight = 'min-h-[200px]' }: Props) {
  return (
    <div
      className={`
        ${minHeight}
        flex flex-col items-center justify-center text-center p-8
        rounded-2xl
        border-2 border-dashed
        border-slate-200 dark:border-slate-700
        bg-white dark:bg-slate-800/50
        hover:border-slate-300 dark:hover:border-slate-600
        hover:bg-slate-50 dark:hover:bg-slate-800
        transition-all duration-200
        group
      `}
    >
      {/* Icono */}
      <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
        <span className="text-3xl">{icon}</span>
      </div>

      {/* Título */}
      <h3 className="text-base font-bold text-slate-700 dark:text-slate-200 mb-1.5">
        {title}
      </h3>

      {/* Descripción */}
      <p className="text-sm text-slate-400 dark:text-slate-500 max-w-xs leading-relaxed mb-4">
        {description}
      </p>

      {/* Badge de etapa */}
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" aria-hidden />
        {step} · Próximamente
      </span>
    </div>
  );
}
