export class AppError extends Error {
  /**
   * @param {string} message
   * @param {number} status
   * @param {object} [details]
   */
  constructor(message, status, details) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.details = details
  }
}

export function notFound(message = 'Not found') {
  return new AppError(message, 404)
}

export function badRequest(message = 'Bad request', details) {
  return new AppError(message, 400, details)
}

export function unprocessable(message = 'Unprocessable entity', details) {
  return new AppError(message, 422, details)
}

export function conflict(message = 'Conflict', details) {
  return new AppError(message, 409, details)
}

export function unauthorized(message = 'Nao autenticado', details) {
  return new AppError(message, 401, details)
}

export function forbidden(message = 'Sem permissao', details) {
  return new AppError(message, 403, details)
}

export function tooManyRequests(message = 'Muitas requisicoes', details) {
  return new AppError(message, 429, details)
}
