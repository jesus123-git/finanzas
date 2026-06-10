'use client';

import { useRef, useState, useEffect } from 'react';
import {
  User, Settings, Lock, HelpCircle, LogOut,
  X, Check, Eye, EyeOff, Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/auth.context';
import { apiPatch } from '@/lib/api';

// ─── Tipos ────────────────────────────────────────────────────────────────────

type Modal = 'profile' | 'password' | null;

// ─── Hook: click fuera ────────────────────────────────────────────────────────

function useClickOutside(ref: React.RefObject<HTMLElement | null>, cb: () => void) {
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) cb();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, cb]);
}

// ─── Modal base ───────────────────────────────────────────────────────────────

function ModalWrap({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-100 dark:border-slate-800">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="font-bold text-slate-800 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Modal perfil ─────────────────────────────────────────────────────────────

function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, login } = useAuth();
  const [name,    setName]    = useState(user?.name ?? '');
  const [email,   setEmail]   = useState(user?.email ?? '');
  const [saving,  setSaving]  = useState(false);
  const [success, setSuccess] = useState(false);
  const [error,   setError]   = useState('');

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess(false);
    try {
      await apiPatch('/auth/profile', { name: name.trim() || undefined, email: email.trim() || undefined });
      setSuccess(true);
      setTimeout(onClose, 1200);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition text-sm';

  return (
    <ModalWrap title="Editar perfil" onClose={onClose}>
      <div className="space-y-4">
        {/* Avatar */}
        <div className="flex justify-center mb-2">
          <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/50 flex items-center justify-center text-2xl font-bold text-violet-600 dark:text-violet-300 select-none">
            {(name || user?.email || 'U')[0].toUpperCase()}
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nombre</label>
          <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Email</label>
          <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" />
        </div>

        {error   && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check size={14} /> Guardado correctamente</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </ModalWrap>
  );
}

// ─── Modal contraseña ─────────────────────────────────────────────────────────

function PasswordModal({ onClose }: { onClose: () => void }) {
  const [current,  setCurrent]  = useState('');
  const [next,     setNext]     = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState('');

  const handleSave = async () => {
    if (next !== confirm) { setError('Las contraseñas nuevas no coinciden'); return; }
    if (next.length < 6)  { setError('La contraseña debe tener al menos 6 caracteres'); return; }
    setSaving(true); setError(''); setSuccess(false);
    try {
      await apiPatch('/auth/password', { currentPassword: current, newPassword: next });
      setSuccess(true);
      setTimeout(onClose, 1400);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Error al cambiar la contraseña');
    } finally {
      setSaving(false);
    }
  };

  const PasswordInput = ({ value, onChange, placeholder, show, onToggle }: {
    value: string; onChange: (v: string) => void; placeholder: string; show: boolean; onToggle: () => void;
  }) => (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-4 py-2.5 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500 transition text-sm"
      />
      <button type="button" onClick={onToggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );

  return (
    <ModalWrap title="Cambiar contraseña" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Contraseña actual</label>
          <PasswordInput value={current} onChange={setCurrent} placeholder="••••••••" show={showCur} onToggle={() => setShowCur(v => !v)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Nueva contraseña</label>
          <PasswordInput value={next} onChange={setNext} placeholder="Mínimo 6 caracteres" show={showNew} onToggle={() => setShowNew(v => !v)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1">Confirmar nueva contraseña</label>
          <PasswordInput value={confirm} onChange={setConfirm} placeholder="Repite la contraseña" show={showNew} onToggle={() => setShowNew(v => !v)} />
        </div>

        {error   && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
        {success && <p className="text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><Check size={14} /> Contraseña actualizada</p>}

        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-violet-400 text-white text-sm font-semibold transition flex items-center justify-center gap-2">
            {saving ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Cambiar contraseña'}
          </button>
        </div>
      </div>
    </ModalWrap>
  );
}

// ─── UserMenu principal ───────────────────────────────────────────────────────

export function UserMenu() {
  const { user, logout } = useAuth();
  const [open,  setOpen]  = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, () => setOpen(false));

  const initial = (user?.name ?? user?.email ?? 'U')[0].toUpperCase();
  const displayName = user?.name ?? user?.email ?? 'Usuario';

  const menuItems = [
    {
      icon: User,
      label: 'Mi perfil',
      desc: 'Editar nombre y email',
      action: () => { setModal('profile'); setOpen(false); },
    },
    {
      icon: Lock,
      label: 'Cambiar contraseña',
      desc: 'Actualizar credenciales',
      action: () => { setModal('password'); setOpen(false); },
    },
    {
      icon: Settings,
      label: 'Configuración',
      desc: 'Preferencias de la cuenta',
      action: () => {},           // próximamente
      disabled: true,
    },
    {
      icon: HelpCircle,
      label: 'Ayuda y soporte',
      desc: 'Centro de ayuda',
      action: () => {},           // próximamente
      disabled: true,
    },
  ];

  return (
    <>
      {/* Botón disparador */}
      <div ref={ref} className="relative">
        <button
          onClick={() => setOpen(v => !v)}
          title={displayName}
          className="relative flex items-center justify-center w-9 h-9 rounded-full ring-2 ring-transparent hover:ring-violet-400 dark:hover:ring-violet-500 focus:outline-none focus:ring-violet-500 transition-all duration-200"
        >
          <div className="w-9 h-9 rounded-full bg-violet-600 dark:bg-violet-700 flex items-center justify-center">
            <span className="text-sm font-bold text-white select-none">{initial}</span>
          </div>
          {/* Indicador de estado activo */}
          <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-white dark:border-slate-800 bg-emerald-400 transition-opacity duration-200 ${open ? 'opacity-0' : 'opacity-100'}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-800 overflow-hidden z-40">
            {/* Encabezado del menú */}
            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900/60 flex items-center justify-center flex-shrink-0">
                  <span className="text-base font-bold text-violet-600 dark:text-violet-300">{initial}</span>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{user?.name ?? 'Sin nombre'}</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Opciones */}
            <div className="py-1">
              {menuItems.map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  disabled={item.disabled}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-violet-50 dark:group-hover:bg-violet-900/30 flex items-center justify-center flex-shrink-0 transition-colors">
                    <item.icon size={15} className="text-slate-500 dark:text-slate-400 group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{item.label}</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">{item.desc}</p>
                  </div>
                  {item.disabled && (
                    <span className="ml-auto text-xs bg-slate-100 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-full">Pronto</span>
                  )}
                </button>
              ))}
            </div>

            {/* Cerrar sesión */}
            <div className="border-t border-slate-100 dark:border-slate-800 py-1">
              <button
                onClick={() => { setOpen(false); logout(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-left group"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 group-hover:bg-red-100 dark:group-hover:bg-red-900/40 flex items-center justify-center flex-shrink-0 transition-colors">
                  <LogOut size={15} className="text-slate-500 dark:text-slate-400 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">Cerrar sesión</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Salir de tu cuenta</p>
                </div>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modales */}
      {modal === 'profile'  && <ProfileModal  onClose={() => setModal(null)} />}
      {modal === 'password' && <PasswordModal onClose={() => setModal(null)} />}
    </>
  );
}
