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

const form = document.querySelector('#loginForm')
const msg = document.querySelector('#msg')

const pwd = form.querySelector('input[name="password"]')
const btn = form.querySelector('button[data-act="toggle"]')
if (btn && pwd) {
  btn.onclick = () => {
    const isPwd = pwd.type === 'password'
    pwd.type = isPwd ? 'text' : 'password'
    btn.textContent = isPwd ? 'Ocultar' : 'Ver'
    btn.setAttribute('aria-label', isPwd ? 'Ocultar senha' : 'Mostrar senha')
    btn.title = isPwd ? 'Ocultar senha' : 'Mostrar senha'
    pwd.focus()
  }
}

form.onsubmit = async (e) => {
  e.preventDefault()
  msg.textContent = ''
  try {
    const fd = new FormData(form)
    const username = String(fd.get('username') || '').trim()
    const password = String(fd.get('password') || '')
    await api('/api/auth/login', { username, password })
    location.href = '/'
  } catch (err) {
    msg.textContent = String(err?.message || err)
  }
}
