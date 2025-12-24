/**
 * Utilitaires de formatage de dates centralisés
 * Format obligatoire : JJ-MM-AAAA (français strict)
 * 
 * RÈGLES :
 * - Aucune dépendance au navigateur ou à la locale
 * - Format unique et cohérent partout dans l'application
 * - Les dates sont stockées en ISO (YYYY-MM-DD) en interne
 * - L'affichage est toujours en JJ-MM-AAAA
 */

/**
 * Formate une date au format français strict JJ-MM-AAAA
 * @param date - Date à formater (Date, string ISO, ou timestamp)
 * @returns String au format JJ-MM-AAAA ou chaîne vide si invalide
 */
export function formatDateFR(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  
  let d: Date;
  
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string") {
    // Parse ISO date or already formatted date
    d = new Date(date);
  } else if (typeof date === "number") {
    d = new Date(date);
  } else {
    return "";
  }
  
  if (isNaN(d.getTime())) return "";
  
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  
  return `${day}-${month}-${year}`;
}

/**
 * Formate une date au format français avec heure : JJ-MM-AAAA à HH:mm
 * @param date - Date à formater
 * @returns String au format JJ-MM-AAAA à HH:mm
 */
export function formatDateTimeFR(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  
  let d: Date;
  
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string") {
    d = new Date(date);
  } else if (typeof date === "number") {
    d = new Date(date);
  } else {
    return "";
  }
  
  if (isNaN(d.getTime())) return "";
  
  const datePart = formatDateFR(d);
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${datePart} à ${hours}:${minutes}`;
}

/**
 * Formate la date du jour au format JJ-MM-AAAA
 * @returns String au format JJ-MM-AAAA
 */
export function getTodayFR(): string {
  return formatDateFR(new Date());
}

/**
 * Formate une date relative (Aujourd'hui, Hier, Il y a X jours, ou JJ-MM-AAAA)
 * @param date - Date à formater
 * @returns String relative ou formatée
 */
export function formatRelativeDateFR(date: Date | string | number | null | undefined): string {
  if (!date) return "";
  
  let d: Date;
  
  if (date instanceof Date) {
    d = date;
  } else if (typeof date === "string") {
    d = new Date(date);
  } else if (typeof date === "number") {
    d = new Date(date);
  } else {
    return "";
  }
  
  if (isNaN(d.getTime())) return "";
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffTime = today.getTime() - target.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays > 1 && diffDays < 7) return `Il y a ${diffDays} jours`;
  
  return formatDateFR(d);
}

/**
 * Normalise une date Excel au format ISO (YYYY-MM-DD)
 * Gère les formats : Excel natif (nombre), DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
 * @param value - Valeur brute depuis Excel
 * @returns Date ISO string ou null si invalide
 */
export function normalizeExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  
  // Excel stores dates as numbers (days since 1900-01-01)
  if (typeof value === "number") {
    // Excel date serial number
    // Note: Excel incorrectly considers 1900 as a leap year, so we adjust
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + value * 24 * 60 * 60 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
    return null;
  }
  
  if (typeof value !== "string") return null;
  
  const str = value.trim();
  if (!str) return null;
  
  // Try different formats
  let date: Date | null = null;
  
  // Format: DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const [, day, month, year] = dmyMatch;
    date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  }
  
  // Format: YYYY-MM-DD or YYYY/MM/DD
  if (!date) {
    const ymdMatch = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
  }
  
  // Try native Date parsing as fallback (for ISO strings)
  if (!date) {
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      date = parsed;
    }
  }
  
  if (date && !isNaN(date.getTime())) {
    return date.toISOString().split("T")[0];
  }
  
  return null;
}

/**
 * Formate une date Excel normalisée au format JJ-MM-AAAA pour affichage
 * @param value - Valeur brute depuis Excel
 * @returns String au format JJ-MM-AAAA ou chaîne vide si invalide
 */
export function formatExcelDateFR(value: unknown): string {
  const isoDate = normalizeExcelDate(value);
  if (!isoDate) return "";
  return formatDateFR(isoDate);
}
