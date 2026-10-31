const defaults = {
  currency: "KWD",
  theme: "system",
  numberLocale: "auto",
  language: "auto",
  reduceMotion: false,
  compactCards: false,
  showReference: true,
  imageFit: "contain"
};
const key = "7sabatk_preferences_v3";
export function getPreferences() {
  try {
    const old = JSON.parse(localStorage.getItem(key) || localStorage.getItem("7sabatk_preferences_v2") || "{}");
    return { ...defaults, ...old };
  } catch {
    return { ...defaults };
  }
}
export function savePreferences(value) {
  localStorage.setItem(key, JSON.stringify({ ...defaults, ...value }));
}
export function resolveLanguage(language = "auto") {
  if (language === "ar" || language === "en") return language;
  return /^ar/i.test(navigator.language || "") ? "ar" : "en";
}
export function applyTheme(theme) {
  const resolved = theme === "system"
    ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
    : theme;
  document.documentElement.dataset.theme = resolved;
}
export async function getCurrencyRates() {
  const cacheKey = "7sabatk_rates_kwd_v1";
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey) || "null");
    if (cached && Date.now() - cached.savedAt < 6 * 60 * 60 * 1000) return cached.rates;
  } catch {}
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/KWD", { cache: "no-store" });
    if (!response.ok) throw new Error("rates unavailable");
    const data = await response.json();
    if (data.result !== "success" || !data.rates) throw new Error("invalid rates");
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), rates: data.rates }));
    return data.rates;
  } catch {
    return { KWD: 1, USD: null, EUR: null, SAR: null, EGP: null };
  }
}
export function formatPrice(priceKwd, currency, rates, locale = "ar") {
  if (priceKwd === null || priceKwd === undefined || priceKwd === "") return locale === "ar" ? "السعر عند الاستفسار" : "Price on request";
  const rate = rates?.[currency];
  if (!rate) return `${new Intl.NumberFormat(locale).format(Number(priceKwd))} KWD`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "KWD" ? 3 : 2
  }).format(Number(priceKwd) * rate);
}
