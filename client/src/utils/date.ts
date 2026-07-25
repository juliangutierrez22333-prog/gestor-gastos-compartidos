// expense_date es una fecha de calendario (YYYY-MM-DD), sin hora ni zona.
// new Date('2026-07-25') la interpretaría como medianoche UTC, y al mostrarla
// en una zona UTC-3 retrocedería al 24/7. Regla: las fechas de calendario se
// formatean como texto, sin pasar nunca por el objeto Date.
export function formatDateOnly(isoDate: string): string {
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) {
    return isoDate;
  }
  return `${Number(day)}/${Number(month)}/${year}`;
}
