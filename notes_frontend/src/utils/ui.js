const LOCALE = undefined;

// PUBLIC_INTERFACE
export function formatDateTime(value) {
  /** Formats a date-like value into a readable local timestamp. */
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// PUBLIC_INTERFACE
export function debounce(fn, waitMs) {
  /** Debounce helper. Returns a debounced function with cancel(). */
  let t = null;
  const debounced = (...args) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), waitMs);
  };
  debounced.cancel = () => {
    if (t) window.clearTimeout(t);
    t = null;
  };
  return debounced;
}
