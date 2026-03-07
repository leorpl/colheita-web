export function fmtNum(n, digits = 2) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtNumInput(n, digits = 2, empty = '') {
  const x = Number(n)
  if (!Number.isFinite(x)) return empty
  return x.toLocaleString('pt-BR', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

export function fmtKg(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return `${fmtNum(x, 0)} kg`
}

export function fmtMoney(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '-'
  return x.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
