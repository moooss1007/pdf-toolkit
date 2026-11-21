const FORMAT = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

export function formatTime(ms: number): string {
  return FORMAT.format(new Date(ms));
}

/** "1 h 20 min", "5 min", or "less than a minute" until `ms`. */
export function timeLeft(ms: number, now = Date.now()): string {
  const minutes = Math.floor((ms - now) / 60_000);
  if (minutes < 1) return "less than a minute";
  const hours = Math.floor(minutes / 60);
  return hours ? `${hours} h ${minutes % 60} min` : `${minutes} min`;
}
