'use client';

import { useEffect, useRef, useState } from 'react';

interface QrScannerProps {
  onScan:  (url: string) => void;
  onClose: () => void;
}

export function QrScanner({ onScan, onClose }: QrScannerProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const scannerRef    = useRef<unknown>(null);
  const [ready,    setReady]    = useState(false);
  const [camError, setCamError] = useState<string | null>(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    let html5QrCode: { start: Function; stop: Function; clear: Function } | null = null;

    // Importación dinámica — html5-qrcode sólo funciona en el browser
    import('html5-qrcode').then(({ Html5Qrcode }) => {
      if (!containerRef.current) return;

      const SCANNER_ID = 'maia-qr-reader';
      html5QrCode = new Html5Qrcode(SCANNER_ID);
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1.0 },
          (decodedText: string) => {
            if (scannedRef.current) return;
            scannedRef.current = true;

            // Detener cámara inmediatamente tras el primer escaneo exitoso
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
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90">
      <div className="relative w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-lg">Escanear Factura DIAN</h2>
            <p className="text-slate-400 text-sm">Apunta la cámara al código QR de la factura</p>
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

        {/* Viewfinder */}
        <div className="relative rounded-2xl overflow-hidden bg-black">
          {/* El div donde html5-qrcode monta el video */}
          <div
            id="maia-qr-reader"
            ref={containerRef}
            className="w-full"
            style={{ minHeight: 300 }}
          />

          {/* Overlay de mira */}
          {ready && !camError && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="relative w-56 h-56">
                {/* Esquinas decorativas */}
                <span className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <span className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                <span className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <span className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                {/* Línea de escaneo animada */}
                <span className="absolute left-2 right-2 h-0.5 bg-emerald-400/70 animate-scan-line" style={{ top: '50%' }} />
              </div>
            </div>
          )}

          {/* Spinner mientras carga */}
          {!ready && !camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-400 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-300 text-sm">Iniciando cámara...</p>
              </div>
            </div>
          )}

          {/* Error de cámara */}
          {camError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 p-6">
              <div className="text-center">
                <div className="text-4xl mb-3">📷</div>
                <p className="text-red-400 font-semibold text-sm">{camError}</p>
                <button
                  onClick={onClose}
                  className="mt-4 px-4 py-2 rounded-xl bg-slate-700 text-white text-sm hover:bg-slate-600 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="text-center text-slate-500 text-xs mt-3">
          Compatible con facturas electrónicas colombianas · DIAN CUFE
        </p>
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
