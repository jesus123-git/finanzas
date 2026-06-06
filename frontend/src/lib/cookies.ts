// Helpers de cookie espejo (usados por AuthContext y por el hook useDashboard)
// Extraídos aquí para evitar importar el contexto completo fuera del árbol React.

export function setSessionCookie(token: string): void {
  document.cookie = `finanzas_session=${token}; path=/; SameSite=Lax; max-age=604800`;
}

export function removeSessionCookie(): void {
  document.cookie = 'finanzas_session=; path=/; max-age=0';
}
