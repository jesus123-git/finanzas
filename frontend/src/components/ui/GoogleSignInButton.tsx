'use client';

import { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/context/auth.context';

// Tipado mínimo de la API global de Google Identity Services
interface GoogleCredentialResponse {
  credential: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: { theme: string; size: string; width: number; text: string; locale: string },
          ) => void;
        };
      };
    };
  }
}

const GSI_SRC = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export function GoogleSignInButton({ text = 'continue_with' }: { text?: string }) {
  const { loginWithGoogle } = useAuth();
  const { resolvedTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!CLIENT_ID) {
      setError('Falta configurar NEXT_PUBLIC_GOOGLE_CLIENT_ID');
      return;
    }

    function loadScript(): Promise<void> {
      return new Promise((resolve, reject) => {
        if (window.google?.accounts?.id) return resolve();
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
        if (existing) {
          existing.addEventListener('load', () => resolve());
          existing.addEventListener('error', () => reject());
          return;
        }
        const script = document.createElement('script');
        script.src = GSI_SRC;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject();
        document.head.appendChild(script);
      });
    }

    let cancelled = false;

    loadScript()
      .then(() => {
        if (cancelled || !window.google || !containerRef.current) return;

        window.google.accounts.id.initialize({
          client_id: CLIENT_ID,
          callback: async (response: GoogleCredentialResponse) => {
            try {
              await loginWithGoogle(response.credential);
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Error al entrar con Google');
            }
          },
        });

        containerRef.current.innerHTML = '';
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: resolvedTheme === 'dark' ? 'filled_black' : 'outline',
          size: 'large',
          width: 320,
          text,
          locale: 'es',
        });
      })
      .catch(() => setError('No se pudo cargar el inicio de sesión con Google'));

    return () => {
      cancelled = true;
    };
  }, [loginWithGoogle, resolvedTheme, text]);

  return (
    <div className="flex flex-col items-center gap-2">
      <div ref={containerRef} className="flex justify-center" />
      {error && <p className="text-xs text-red-500 dark:text-red-400 text-center">{error}</p>}
    </div>
  );
}
