/** Small array helpers — keep out of heavy modules to avoid layout bundle bloat. */
export function unique(arr) {
  return [...new Set(arr.filter(Boolean))]
}
