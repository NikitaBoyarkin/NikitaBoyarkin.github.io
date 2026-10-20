export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    // Frontmatter carries date-only values, which parse as UTC midnight. Without
    // an explicit zone the formatter uses the *reader's* zone, so a post dated
    // 2026-08-05 renders as "Aug 4" for anyone west of UTC. A publication date
    // is a calendar fact, not an instant — pin it to UTC.
    timeZone: "UTC",
  });
}

export function estimateReadTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.round(words / 200));
}
