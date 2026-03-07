export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) {
    if (res.status === 401 && location.pathname !== '/login') {
      location.href = '/login'
      return null
    }
    const msg = data?.message || `Erro ${res.status}`
    const err = new Error(msg)
    if (data?.details) err.details = data.details
    throw err
  }
  return data
}
