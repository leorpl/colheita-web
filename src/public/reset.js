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

function togglePwd(input, btn) {
  if (!input || !btn) return
  const isPwd = input.type === 'password'
  input.type = isPwd ? 'text' : 'password'
  btn.textContent = isPwd ? 'Ocultar' : 'Ver'
  btn.setAttribute('aria-label', isPwd ? 'Ocultar senha' : 'Mostrar senha')
  btn.title = isPwd ? 'Ocultar senha' : 'Mostrar senha'
  input.focus()
}

const form = document.querySelector('#resetForm')
const msg = document.querySelector('#msg')

const qp = new URLSearchParams(location.search)
const token = String(qp.get('token') || '').trim()
form.querySelector('input[name="token"]').value = token

const p1 = form.querySelector('input[name="password"]')
const p2 = form.querySelector('input[name="password2"]')
const b1 = form.querySelector('button[data-act="toggle"]')
const b2 = form.querySelector('button[data-act="toggle2"]')
if (b1) b1.onclick = () => togglePwd(p1, b1)
if (b2) b2.onclick = () => togglePwd(p2, b2)

form.onsubmit = async (e) => {
  e.preventDefault()
  msg.textContent = ''
  try {
    const fd = new FormData(form)
    const token2 = String(fd.get('token') || '').trim()
    const password = String(fd.get('password') || '')
    const password2 = String(fd.get('password2') || '')
    if (!token2) throw new Error('Token ausente.')
    if (!password || password.length < 8) throw new Error('Senha deve ter ao menos 8 caracteres.')
    if (password !== password2) throw new Error('Confirmação não confere.')

    await api('/api/auth/reset', { token: token2, password })
    msg.textContent = 'Senha atualizada. Você já pode entrar.'
    setTimeout(() => (location.href = '/login'), 800)
  } catch (err) {
    msg.textContent = String(err?.message || err)
  }
}
