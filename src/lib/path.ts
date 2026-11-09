export function withBase(path: string): string {
  // Absolute URLs (an external hub such as the conference programme) are
  // already complete; prefixing them with the base path would break them.
  if (/^(?:[a-z][a-z\d+.-]*:)?\/\//i.test(path) || path.startsWith("mailto:")) return path;
  const base = import.meta.env.BASE_URL;
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  return `${normalizedBase}${normalizedPath}`;
}
