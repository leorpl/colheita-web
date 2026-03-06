async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const text = await res.text()
  const data = text ? JSON.parse(text) : null
  if (!res.ok) throw new Error(data?.message || `Erro ${res.status}`)
  return data
}

const form = document.querySelector('#forgotForm')
const msg = document.querySelector('#msg')

form.onsubmit = async (e) => {
  e.preventDefault()
  msg.textContent = ''
  try {
    const fd = new FormData(form)
    const email = String(fd.get('email') || '').trim()
    await api('/api/auth/forgot', { email })
    msg.textContent = 'Se o e-mail existir, você receberá um link de redefinição em instantes.'
  } catch (err) {
    msg.textContent = String(err?.message || err)
  }
}
