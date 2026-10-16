/** "45 seconds", "12 minutes", "5 hours", "7 days": one unit, rounded down. */
export function plainDuration(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const unit = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
  if (s < 60) return unit(s, "second", "seconds")
  const m = Math.floor(s / 60)
  if (m < 60) return unit(m, "minute", "minutes")
  const h = Math.floor(m / 60)
  if (h < 48) return unit(h, "hour", "hours")
  return unit(Math.floor(h / 24), "day", "days")
}
