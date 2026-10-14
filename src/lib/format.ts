import type { Locale } from "./i18n";

const tag = (locale: Locale) => (locale === "fr" ? "fr-FR" : "en-GB");

export function formatNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(tag(locale)).format(value);
}

export function formatBytes(bytes: number, locale: Locale) {
  const units = locale === "fr" ? ["o", "Ko", "Mo", "Go", "To"] : ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  const digits = unit === 0 || value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${new Intl.NumberFormat(tag(locale), { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

export function formatDate(time: number | Date, locale: Locale) {
  return new Intl.DateTimeFormat(tag(locale), {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(time);
}

export function formatRelative(time: number, locale: Locale, now = Date.now()) {
  const rtf = new Intl.RelativeTimeFormat(tag(locale), { numeric: "auto" });
  const seconds = Math.round((time - now) / 1000);
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 60],
    ["minute", 60],
    ["hour", 24],
    ["day", 7],
    ["week", 4.35],
    ["month", 12],
    ["year", Infinity],
  ];
  let value = seconds;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return rtf.format(Math.round(value), "year");
}

export function formatExposure(seconds: number) {
  if (seconds >= 1) return `${Number(seconds.toFixed(1))} s`;
  return `1/${Math.round(1 / seconds)} s`;
}
