import chalk from 'chalk'

export function euroString(value) {
  return `${Number(value).toFixed(2)} €`
}

export function coloredEuroString(value) {
  const text = euroString(value)
  if (Number(value) < 0) {
    return chalk.red(text)
  }
  return chalk.green(text)
}
