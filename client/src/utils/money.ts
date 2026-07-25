// Manejo de dinero en el cliente: mismos principios que el backend,
// los montos viajan y se calculan siempre como enteros en centavos.

const formatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
});

export function formatCents(cents: number): string {
  // La división solo ocurre al mostrar; el formateador redondea a 2 decimales.
  return formatter.format(cents / 100);
}

// Convierte lo que tipea el usuario ("150", "150,5", "150.50") a centavos
// usando aritmética de strings y enteros: nunca pasa por un float, así
// "0,29" da exactamente 29 y no 28.999...
// Devuelve null si el formato no es válido (sin separador de miles).
export function parseAmountToCents(input: string): number | null {
  const normalized = input.trim().replace(',', '.');
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(normalized);
  if (!match?.[1]) {
    return null;
  }
  const wholePart = Number(match[1]);
  const centsPart = Number((match[2] ?? '').padEnd(2, '0'));
  return wholePart * 100 + centsPart;
}
