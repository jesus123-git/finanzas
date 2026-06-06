import { NextRequest, NextResponse } from 'next/server';

// ─── Rutas y su política de acceso ───────────────────────────────────────────

// Requieren sesión activa. Si no hay token → redirect a /login
const PROTECTED_PREFIXES = ['/dashboard', '/accounts', '/transactions', '/goals'];

// Solo para usuarios NO autenticados. Si ya hay token → redirect a /dashboard
const AUTH_ONLY_PATHS = ['/login', '/register'];

// ─── Middleware ───────────────────────────────────────────────────────────────
//
// Next.js ejecuta este archivo en el Edge Runtime ANTES de renderizar cualquier
// página. Es el lugar correcto para redireccionamientos basados en sesión porque:
//   1. No hay parpadeo de UI (el redirect ocurre antes de que el HTML llegue al browser)
//   2. No consume CPU del servidor principal (Edge = worker ultraligero)
//
// IMPORTANTE: el token vive en localStorage (client-side), no en cookies.
// El middleware Edge no puede leer localStorage. Por eso usamos una cookie
// espejo llamada 'finanzas_session' que AuthContext sincroniza.
// Esto es el patrón estándar para Next.js App Router.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Leemos la cookie espejo que AuthContext mantiene sincronizada
  const sessionCookie = request.cookies.get('finanzas_session')?.value;
  const isAuthenticated = Boolean(sessionCookie);

  // ── Ruta protegida sin sesión → redirect a login ─────────────────────────
  const needsAuth = PROTECTED_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  if (needsAuth && !isAuthenticated) {
    const loginUrl = new URL('/login', request.url);
    // Guardamos la URL original para redirigir de vuelta después del login
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Ruta de auth con sesión activa → redirect a dashboard ────────────────
  const isAuthPage = AUTH_ONLY_PATHS.some((p) => pathname === p);
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

// ─── Configuración del matcher ────────────────────────────────────────────────
// Limita qué rutas activan el middleware.
// Excluimos archivos estáticos, assets y rutas internas de Next.js
// para no añadir latencia innecesaria.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
