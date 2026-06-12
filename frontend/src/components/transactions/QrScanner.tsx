'use client';

import { useEffect, useRef, useState } from 'react';

interface QrScannerProps {
  onScan:  (url: string) => void;
  onClose: () => void;
}

type Mode = 'choose' | 'live' | 'processing';

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerRef   = useRef<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scannedRef   = useRef(false);

  const [mode,      setMode]      = useState<Mode>('choose');
  const [ready,     setReady]     = useState(false);
  const [camError,  setCamError]  = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  // ── Cámara en vivo ────────────────────────────────────────────────────────
  useEffect(() => {
    if (mode !== 'live') return;

    let html5QrCode: { start: Function; stop: Function; clear: Function } | null = null;

    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!containerRef.current) return;

      html5QrCode = new Html5Qrcode('maia-qr-reader');
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
          (decodedText: string) => {
            if (scannedRef.current) return;
            scannedRef.current = true;
            html5QrCode!.stop().then(() => {
              html5QrCode!.clear();
              onScan(decodedText);
            }).catch(() => onScan(decodedText));
          },
          () => { /* errores por frame — ignorar */ },
        )
        .then(() => setReady(true))
        .catch((err: Error) => {
          setCamError(
            err.message.includes('Permission')
              ? 'Permiso de cámara denegado. Actívalo en la configuración del navegador.'
              : `No se pudo iniciar la cámara: ${err.message}`,
          );
        });
    });

    return () => {
      if (html5QrCode && !scannedRef.current) {
        html5QrCode.stop().catch(() => {}).finally(() => html5QrCode!.clear());
      }
    };
  }, [mode, onScan]);

  // ── Foto estática ─────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    setMode('processing');

    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode('maia-qr-file-reader');
      const result  = await scanner.scanFile(file, true);
      onScan(result);
    } catch {
      setMode('choose');
      setFileError('No se pudo leer el QR. Asegurate de que la foto sea clara y el código esté bien enfocado.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // ── UI ────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90">
      <div className="relative w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Escanear Factura DIAN</h2>
            <p className="text-slate-400 text-sm">
              {mode === 'live'       ? 'Apunta la cámara al código QR' :
               mode === 'processing' ? 'Procesando imagen…'            :
               'Elige cómo escanear el QR'}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar escáner"
            className="p-2 rounded-xl bg-slate-700/60 text-slate-300 hover:bg-slate-600/60 hover:text-white transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Pantalla de elección ── */}
        {mode === 'choose' && (
          <div className="flex flex-col gap-3">
            <button
              onClick={() => setMode('live')}
              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-500/50 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.868v6.264a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Cámara en vivo</p>
                <p className="text-slate-400 text-xs mt-0.5">Escaneo automático apuntando al QR</p>
              </div>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-4 p-4 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-blue-500/50 transition-all text-left group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Tomar foto de la factura</p>
                <p className="text-slate-400 text-xs mt-0.5">Captura con la cámara y detecta el QR</p>
              </div>
            </button>

            {fileError && (
              <div className="p-3 rounded-xl bg-red-900/30 border border-red-700/40">
                <p className="text-red-400 text-xs">{fileError}</p>
              </div>
            )}

            <p className="text-center text-slate-500 text-xs mt-1">
              Compatible con facturas electrónicas colombianas · DIAN CUFE
            </p>
          </div>
        )}

        {/* ── Cámara en vivo ── */}
        {mode === 'live' && (
          <>
            <div className="relative rounded-2xl overflow-hidden bg-black">
              <div
                id="maia-qr-reader"
                ref={containerRef}
                className="w-full"
                style={{ minHeight: 300 }}
              />

              {ready && !camError && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="relative w-56 h-56">
                    <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                    <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                    <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                    <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                    <span className="absolute left-2 right-2 h-0.5 bg-emerald-400/70 animate-scan-line" style={{ top: '50%' }} />
                  </div>
                </div>
              )}

              {!ready && !camError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-300 text-sm">Iniciando cámara...</p>
                  </div>
                </div>
              )}

              {camError && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
                  <div className="text-center">
                    <div className="text-4xl mb-3">📷</div>
                    <p className="text-red-400 font-semibold text-sm">{camError}</p>
                    <button
                      onClick={() => { setCamError(null); setReady(false); setMode('choose'); }}
                      className="mt-4 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm hover:bg-slate-600 transition-colors"
                    >
                      Volver
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => { setCamError(null); setReady(false); setMode('choose'); }}
              className="mt-3 w-full py-2 rounded-xl bg-slate-700/60 text-slate-300 text-sm hover:bg-slate-700 transition-colors"
            >
              ← Volver
            </button>
          </>
        )}

        {/* ── Procesando foto ── */}
        {mode === 'processing' && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
            <p className="text-slate-300 text-sm">Leyendo código QR...</p>
          </div>
        )}

        {/* Input oculto para captura de foto */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Div oculto requerido por Html5Qrcode.scanFile() */}
        <div id="maia-qr-file-reader" className="hidden" />
      </div>

      <style jsx>{`
        @keyframes scan-line {
          0%, 100% { transform: translateY(-48px); opacity: 0.7; }
          50%       { transform: translateY(48px);  opacity: 1;   }
        }
        .animate-scan-line { animation: scan-line 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
