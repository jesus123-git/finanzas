export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold text-brand-500">Finanzas</h1>
      <p className="text-lg text-gray-600">
        Base del proyecto lista. ¡Empieza a construir!
      </p>
      <a
        href="/api/health"
        className="rounded-lg bg-brand-500 px-6 py-2 text-white hover:opacity-90 transition"
      >
        Verificar API →
      </a>
    </main>
  );
}
