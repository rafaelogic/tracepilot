export function delta(base: number | null | undefined, target: number | null | undefined) {
  if (typeof base !== "number" || typeof target !== "number") return null;
  return Math.round(target - base);
}
