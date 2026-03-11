/** Parse a duration string like "7d", "24h", "30m", "60s" to seconds. */
export function parseExpiresIn(value: string): number {
  const match = value.match(/^(\d+)([dhms])$/)
  if (!match) {
    throw new Error(`Invalid expires format: "${value}". Expected e.g. "7d", "24h", "30m", "60s".`)
  }

  const amount = parseInt(match[1], 10)
  const unit = match[2]

  switch (unit) {
    case 'd':
      return amount * 86400
    case 'h':
      return amount * 3600
    case 'm':
      return amount * 60
    case 's':
      return amount
    default:
      throw new Error(`Unknown time unit: ${unit}`)
  }
}
