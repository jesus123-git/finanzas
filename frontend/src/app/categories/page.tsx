'use client';

import { useState, useEffect, useCallback, FormEvent } from 'react';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/ui/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { ToastContainer, useToast } from '@/components/ui/Toast';
import { useAuth } from '@/context/auth.context';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Category { id: string; name: string }

// ─── Colores de las chips ─────────────────────────────────────────────────────
// Se asignan cíclicamente por posición en la lista

const CHIP_COLORS = [
  'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  'bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800',
  'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800',
  'bg-cyan-100 dark:bg-cyan-900/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800',
  'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800',
  'bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 border-pink-200 dark:border-pink-800',
  'bg-lime-100 dark:bg-lime-900/40 text-lime-700 dark:text-lime-300 border-lime-200 dark:border-lime-800',
  'bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-600',
];

// ─── Página ───────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { user, logout } = useAuth();
  const { toasts, toast, dismissToast } = useToast();

  const [categories,  setCategories]  = useState<Category[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [deletingId,  setDeletingId]  = useState<string | null>(null);
  const [confirmId,   setConfirmId]   = useState<string | null>(null);
  const [seeding,     setSeeding]     = useState(false);

  // ── Formulario nueva categoría ────────────────────────────────────────────
  const [newName,     setNewName]     = useState('');
  const [creating,    setCreating]    = useState(false);
  const [createError, setCreateError] = useState('');
  const [showForm,    setShowForm]    = useState(false);

  // ── Cargar categorías ─────────────────────────────────────────────────────
  const loadCategories = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Category[]>('/categories');
      setCategories(data);
    } catch {
      toast('No se pudieron cargar las categorías', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadCategories(); }, [loadCategories]);

  // ── Crear categoría ───────────────────────────────────────────────────────
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name) { setCreateError('El nombre no puede estar vacío'); return; }
    if (name.length > 50) { setCreateError('Máximo 50 caracteres'); return; }
    setCreateError('');
    setCreating(true);
    try {
      const created = await apiPost<Category>('/categories', { name });
      setCategories(prev => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewName('');
      setShowForm(false);
      toast(`Categoría "${created.name}" creada ✓`, 'success');
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Error al crear');
    } finally {
      setCreating(false);
    }
  };

  // ── Eliminar categoría ────────────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await apiDelete(`/categories/${id}`);
      setCategories(prev => prev.filter(c => c.id !== id));
      setConfirmId(null);
      toast('Categoría eliminada', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'No se pudo eliminar', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // ── Seed de categorías por defecto ────────────────────────────────────────
  const handleSeedDefaults = async () => {
    setSeeding(true);
    try {
      await apiPost('/categories/seed-defaults', {});
      await loadCategories();
      toast('Categorías por defecto cargadas 🎉', 'success');
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Error al cargar categorías', 'error');
    } finally {
      setSeeding(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header className="bg-white/90 dark:bg-slate-950/90 backdrop-blur-xl border-b border-slate-200/80 dark:border-slate-800/80 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">

          {/* Logo + breadcrumb */}
          <div className="flex items-center gap-3">
            <Logo size={32} href="/dashboard" />
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-slate-300 dark:text-slate-600">/</span>
              <span className="font-semibold text-slate-600 dark:text-slate-300">Mis categorías</span>
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={() => { setShowForm(true); setNewName(''); setCreateError(''); }}
              className="flex items-center gap-1.5 text-sm font-semibold px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">Nueva</span>
            </button>

            {/* Avatar */}
            <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                <span className="text-sm font-bold text-violet-600 dark:text-violet-400">
                  {(user?.name ?? user?.email ?? 'U')[0].toUpperCase()}
                </span>
              </div>
            </div>
            <button onClick={logout} className="text-sm px-3 py-2 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* ── Cuerpo ────────────────────────────────────────────────────────── */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">

        {/* Título */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Mis categorías</h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-0.5">
              Organiza tus transacciones por tipo de gasto o ingreso
            </p>
          </div>
          <button
            onClick={handleSeedDefaults}
            disabled={seeding}
            className={cn(
              'flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl transition-all flex-shrink-0',
              'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300',
              'border border-violet-200 dark:border-violet-800',
              'hover:bg-violet-100 dark:hover:bg-violet-900/50',
              seeding && 'opacity-60 cursor-not-allowed',
            )}
          >
            {seeding ? (
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <span aria-hidden>✨</span>
            )}
            <span className="hidden sm:inline">Cargar por defecto</span>
            <span className="sm:hidden">Por defecto</span>
          </button>
        </div>

        {/* Formulario nueva categoría */}
        {showForm && (
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-5">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Nueva categoría</h2>
            <form onSubmit={handleCreate} className="flex gap-3 flex-wrap">
              <input
                type="text"
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(''); }}
                placeholder="ej. Comida, Servicios, Transporte…"
                maxLength={50}
                autoFocus
                className={cn(
                  'flex-1 min-w-[200px] rounded-xl border px-3 py-2 text-sm',
                  'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100',
                  'focus:outline-none focus:ring-2 focus:ring-violet-400',
                  createError
                    ? 'border-rose-400 dark:border-rose-600'
                    : 'border-slate-200 dark:border-slate-600',
                )}
                aria-describedby={createError ? 'create-error' : undefined}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-violet-500 hover:bg-violet-600 disabled:opacity-50 transition-colors"
                >
                  {creating ? 'Creando…' : 'Crear'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setCreateError(''); }}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancelar
                </button>
              </div>
              {createError && (
                <p id="create-error" className="w-full text-xs text-rose-500 dark:text-rose-400 -mt-1">
                  {createError}
                </p>
              )}
            </form>
          </div>
        )}

        {/* Lista de categorías */}
        {loading ? (
          /* Skeleton */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
            ))}
          </div>
        ) : categories.length === 0 ? (
          /* Estado vacío */
          <div className="bg-white dark:bg-slate-800 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
            <p className="text-4xl mb-3" aria-hidden>🏷️</p>
            <p className="text-base font-semibold text-slate-600 dark:text-slate-300">Sin categorías</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1 mb-5">
              Crea tus propias categorías o carga las que vienen por defecto
            </p>
            <button
              onClick={handleSeedDefaults}
              disabled={seeding}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-violet-500 hover:bg-violet-600 transition-colors disabled:opacity-50"
            >
              ✨ Cargar categorías por defecto
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {categories.map((cat, i) => {
              const colorClass = CHIP_COLORS[i % CHIP_COLORS.length];
              const isConfirm  = confirmId === cat.id;
              const isDeleting = deletingId === cat.id;

              return (
                <div
                  key={cat.id}
                  className={cn(
                    'group relative flex items-center justify-between',
                    'rounded-2xl border px-4 py-3 transition-all duration-150',
                    colorClass,
                    isConfirm && 'ring-2 ring-rose-400',
                  )}
                >
                  {isConfirm ? (
                    /* Modo confirmación */
                    <div className="w-full flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold leading-tight">¿Eliminar?</p>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => handleDelete(cat.id)}
                          disabled={isDeleting}
                          className="text-[11px] font-bold text-white bg-rose-500 hover:bg-rose-600 px-2 py-0.5 rounded-lg transition-colors"
                        >
                          {isDeleting ? '…' : 'Sí'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          className="text-[11px] font-semibold bg-white/60 dark:bg-slate-700/60 px-2 py-0.5 rounded-lg hover:opacity-80 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <span className="text-sm font-semibold truncate pr-1">{cat.name}</span>
                      {/* Botón eliminar — visible al hacer hover */}
                      <button
                        onClick={() => setConfirmId(cat.id)}
                        className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 rounded-full bg-white/60 dark:bg-slate-700/60 hover:bg-rose-500 hover:text-white flex items-center justify-center transition-all"
                        aria-label={`Eliminar categoría ${cat.name}`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Nota informativa */}
        {categories.length > 0 && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/40 px-4 py-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ No puedes eliminar una categoría que tenga transacciones asociadas. Reasigna o elimina las transacciones primero.
            </p>
          </div>
        )}

        {/* Contador */}
        {!loading && categories.length > 0 && (
          <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
            {categories.length} categoría{categories.length !== 1 ? 's' : ''} en total
          </p>
        )}

        {/* Volver al dashboard */}
        <div className="flex justify-center pt-2 pb-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-sm text-slate-400 dark:text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al dashboard
          </Link>
        </div>
      </main>

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
