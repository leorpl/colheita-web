export function nowDbText(date = new Date()) {
  // Mantem compatibilidade com o formato historico do SQLite: "YYYY-MM-DD HH:MM:SS".
  return date.toISOString().slice(0, 19).replace('T', ' ')
}
