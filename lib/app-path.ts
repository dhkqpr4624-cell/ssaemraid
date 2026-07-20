/**
 * Returns an application-relative URL that works on Vercel/Netlify (root path)
 * and on GitHub project Pages (/repository-name).
 */
export function appPath(pathname: string): string {
  const normalized = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (!basePath) return normalized;
  if (normalized === basePath || normalized.startsWith(`${basePath}/`)) return normalized;
  return `${basePath}${normalized}`;
}

export function appUrl(pathname: string): string {
  if (typeof window === 'undefined') return appPath(pathname);
  return new URL(appPath(pathname), window.location.origin).toString();
}
