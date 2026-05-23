export const INCIDENT_API_URL_HOST = "http://localhost:8080";
export const GEMINI_API_KEY = "AIzaSyDYFucaitEtLaOMVi7DNqqoDW95ncIKs1Q";

export const C = {
  critical: "#dc2626", criticalBg: "#fef2f2", criticalBorder: "#fca5a5", criticalText: "#b91c1c",
  high: "#d97706", highBg: "#fffbeb", highBorder: "#fcd34d", highText: "#92400e",
  medium: "#f97316", mediumBg: "#fff7ed", mediumBorder: "#fdba74", mediumText: "#c2410c",
  safe: "#16a34a", safeBg: "#f0fdf4", safeBorder: "#86efac", safeText: "#15803d",
  info: "#1d4ed8", infoBg: "#eff6ff", infoBorder: "#93c5fd", infoText: "#1e40af",
  bg: "#f9fafb", surface: "#ffffff", border: "#e5e7eb", borderStrong: "#d1d5db",
  text: "#111827", textSec: "#374151", textMuted: "#6b7280", textDim: "#9ca3af",
  navActive: "#1d4ed8", navInactive: "#9ca3af",
};

export const T = {
  heading1: { fontSize: 22, fontWeight: "700", color: C.text, letterSpacing: -0.5 },
  heading2: { fontSize: 18, fontWeight: "700", color: C.text },
  heading3: { fontSize: 16, fontWeight: "600", color: C.text },
  body: { fontSize: 14, fontWeight: "400", color: C.textSec, lineHeight: 21 },
  caption: { fontSize: 12, fontWeight: "400", color: C.textMuted, lineHeight: 18 },
  label: { fontSize: 11, fontWeight: "600", color: C.textDim, textTransform: "uppercase", letterSpacing: 0.6 },
};

export const SPACING = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const RADIUS = { sm: 6, md: 10, lg: 14, pill: 999 };

export const SHADOW = {
  card: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
};

export function riskColors(label = "") {
  const s = label.toLowerCase();
  if (s.includes("critical")) return { base: C.critical, bg: C.criticalBg, border: C.criticalBorder, text: C.criticalText };
  if (s.includes("high"))     return { base: C.high,     bg: C.highBg,     border: C.highBorder,     text: C.highText     };
  if (s.includes("medium") || s.includes("moderate")) return { base: C.medium, bg: C.mediumBg, border: C.mediumBorder, text: C.mediumText };
  return { base: C.safe, bg: C.safeBg, border: C.safeBorder, text: C.safeText };
}