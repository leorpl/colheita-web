export async function renderComunicacaoRoute({ activeNav, setView, escapeHtml, toast, api, viewEl, me } = {}) {
  if (typeof activeNav !== 'function') throw new Error('activeNav obrigatorio')
  if (typeof setView !== 'function') throw new Error('setView obrigatorio')
  if (typeof escapeHtml !== 'function') throw new Error('escapeHtml obrigatorio')
  if (typeof toast !== 'function') throw new Error('toast obrigatorio')
  if (typeof api !== 'function') throw new Error('api obrigatorio')
  if (!viewEl) throw new Error('viewEl obrigatorio')

  activeNav('comunicacao')

  const currentMe = me ?? window.__me ?? null
  const can = await api('/api/auth/can?module=comunicacao').catch(() => null)
  const canUpdate = can ? Boolean(can.can_update) : true

  const webmail = await api('/api/comunicacao/webmail').catch(() => null)
  const prefsR = await api('/api/notifications/preferences').catch(() => ({ prefs: [] }))
  const prefs = Array.isArray(prefsR?.prefs) ? prefsR.prefs : []

  const modules = [
    { key: '*', label: 'Todos os modulos (geral)' },
    { key: 'colheita', label: 'Colheita' },
    { key: 'regras-destino', label: 'Regras do destino' },
    { key: 'contratos-silo', label: 'Contratos (travas)' },
    { key: 'safras', label: 'Safras' },
    { key: 'talhoes', label: 'Talhoes' },
    { key: 'destinos', label: 'Destinos' },
    { key: 'motoristas', label: 'Motoristas' },
    { key: 'fretes', label: 'Fretes' },
    { key: 'tipos-plantio', label: 'Tipos de plantio' },
    { key: 'usuarios', label: 'Usuarios' },
    { key: 'acl', label: 'Permissoes/ACL' },
    { key: 'auth', label: 'Seguranca (login/reset)' },
  ]

  const map = new Map(prefs.map((p) => [String(p.module || '').toLowerCase(), p]))
  function getRow(mod) {
    return (
      map.get(String(mod).toLowerCase()) || {
        module: mod,
        notify_create: 0,
        notify_update: 0,
        notify_delete: 0,
        notify_status_change: 0,
        notify_security_events: 0,
        delivery_mode: 'immediate',
      }
    )
  }

  const rowsHtml = modules
    .map((m) => {
      const r = getRow(m.key)
      const dis = canUpdate ? '' : 'disabled'
      return `
        <tr>
          <td><code class="mono">${escapeHtml(m.key)}</code><div class="hint">${escapeHtml(m.label)}</div></td>
          <td class="t-center"><input ${dis} type="checkbox" name="${escapeHtml(`c_${m.key}`)}" ${Number(r.notify_create) === 1 ? 'checked' : ''} /></td>
          <td class="t-center"><input ${dis} type="checkbox" name="${escapeHtml(`u_${m.key}`)}" ${Number(r.notify_update) === 1 ? 'checked' : ''} /></td>
          <td class="t-center"><input ${dis} type="checkbox" name="${escapeHtml(`d_${m.key}`)}" ${Number(r.notify_delete) === 1 ? 'checked' : ''} /></td>
          <td class="t-center"><input ${dis} type="checkbox" name="${escapeHtml(`s_${m.key}`)}" ${Number(r.notify_status_change) === 1 ? 'checked' : ''} /></td>
          <td class="t-center"><input ${dis} type="checkbox" name="${escapeHtml(`sec_${m.key}`)}" ${Number(r.notify_security_events) === 1 ? 'checked' : ''} /></td>
        </tr>
      `.trim()
    })
    .join('')

  const cardsHtml = modules
    .map((m) => {
      const r = getRow(m.key)
      const dis = canUpdate ? '' : 'disabled'
      return `
        <div class="mobile-card">
          <div class="mobile-card-head">
            <div>
              <div class="mobile-card-title"><code class="mono">${escapeHtml(m.key)}</code></div>
              <div class="mobile-card-sub">${escapeHtml(m.label)}</div>
            </div>
          </div>
          <div class="mobile-kv">
            <div><span>Criar</span><b><input ${dis} type="checkbox" name="${escapeHtml(`c_${m.key}`)}" ${Number(r.notify_create) === 1 ? 'checked' : ''} /></b></div>
            <div><span>Alterar</span><b><input ${dis} type="checkbox" name="${escapeHtml(`u_${m.key}`)}" ${Number(r.notify_update) === 1 ? 'checked' : ''} /></b></div>
            <div><span>Excluir</span><b><input ${dis} type="checkbox" name="${escapeHtml(`d_${m.key}`)}" ${Number(r.notify_delete) === 1 ? 'checked' : ''} /></b></div>
            <div><span>Status</span><b><input ${dis} type="checkbox" name="${escapeHtml(`s_${m.key}`)}" ${Number(r.notify_status_change) === 1 ? 'checked' : ''} /></b></div>
            <div><span>Segurança</span><b><input ${dis} type="checkbox" name="${escapeHtml(`sec_${m.key}`)}" ${Number(r.notify_security_events) === 1 ? 'checked' : ''} /></b></div>
          </div>
        </div>
      `.trim()
    })
    .join('')

  const webmailUrl = webmail?.url || ''
  const webmailLabel = webmail?.label || 'Webmail da fazenda'
  const webmailHint = webmail?.hint || ''

  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Comunicacao</div>
          <div class="panel-sub">Atalhos e preferencia de notificacoes por e-mail.</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span6">
            <div class="stat">
              <div class="stat-k">Webmail da fazenda</div>
              <div class="hint" style="margin-top:6px">Abertura em nova aba (provedor oficial).</div>
              ${webmailHint ? `<div class="hint" style="margin-top:6px">${escapeHtml(webmailHint)}</div>` : ''}
              <div style="margin-top:10px;display:flex;gap:10px;flex-wrap:wrap">
                <a class="btn" href="${escapeHtml(webmailUrl || '#')}" target="_blank" rel="noreferrer" ${webmailUrl ? '' : 'aria-disabled="true"'}>${escapeHtml(webmailLabel)}</a>
              </div>
              ${!webmailUrl ? `<div class="hint" style="margin-top:10px">Configure <code class="mono">WEBMAIL_URL</code> no ambiente para habilitar o atalho.</div>` : ''}
            </div>
          </div>

          <div class="span6">
            <div class="stat">
              <div class="stat-k">Preferencias de notificacao</div>
              <div class="hint" style="margin-top:6px">Escolha o que voce quer receber por e-mail. (Envio imediato; resumo diario pode ser adicionado depois.)</div>
              ${!canUpdate ? `<div class="pill" style="margin-top:10px"><span class="dot muted"></span><span>Somente leitura: sem permissao para alterar preferencias.</span></div>` : ''}
              <form id="notifForm" style="margin-top:10px">
                <div class="mobile-cards notif-mobile-cards" style="display:none">${cardsHtml}</div>
                <div class="table-wrap rule-wrap notif-desktop-wrap">
                  <table>
                    <thead><tr><th>Modulo</th><th class="t-center">Criar</th><th class="t-center">Alterar</th><th class="t-center">Excluir</th><th class="t-center">Status</th><th class="t-center">Seguranca</th></tr></thead>
                    <tbody>${rowsHtml}</tbody>
                  </table>
                </div>
                <div style="margin-top:10px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
                  <button class="btn ghost" type="button" id="btnNotifDefaults">Defaults</button>
                  <button class="btn" type="button" id="btnNotifSave">Salvar preferencias</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  `)

  const form = viewEl.querySelector('#notifForm')
  const btnSave = viewEl.querySelector('#btnNotifSave')
  const btnDef = viewEl.querySelector('#btnNotifDefaults')
  const mobileCards = viewEl.querySelector('.notif-mobile-cards')

  function applyDefaults() {
    const isAdmin = String(currentMe?.role || '').toLowerCase() === 'admin'
    // Default: security for all; admins get broader
    for (const m of modules) {
      const k = m.key
      const set = (name, v) => {
        const el = form.querySelector(`input[name="${CSS.escape(name)}"]`)
        if (el) el.checked = Boolean(v)
      }
      const sec = k === 'auth' || k === 'acl' || k === 'usuarios' || k === '*'
      set(`sec_${k}`, sec)
      if (isAdmin) {
        set(`c_${k}`, k === '*' || k === 'colheita' || k === 'regras-destino' || k === 'usuarios')
        set(`u_${k}`, k === '*' || k === 'colheita' || k === 'regras-destino' || k === 'usuarios')
        set(`d_${k}`, k === '*' || k === 'colheita' || k === 'usuarios')
        set(`s_${k}`, k === '*' || k === 'usuarios')
      }
    }
  }

  if (btnDef) {
    btnDef.disabled = !canUpdate
    btnDef.onclick = () => {
      if (!canUpdate) return
      applyDefaults()
      toast('OK', 'Defaults aplicados (nao esquece de salvar).')
    }
  }

  if (btnSave) {
    btnSave.disabled = !canUpdate
    btnSave.onclick = async () => {
      if (!canUpdate) return
      const out = modules.map((m) => {
        const k = m.key
        const get = (name) => Boolean(form.querySelector(`input[name="${CSS.escape(name)}"]`)?.checked)
        return {
          module: k,
          notify_create: get(`c_${k}`),
          notify_update: get(`u_${k}`),
          notify_delete: get(`d_${k}`),
          notify_status_change: get(`s_${k}`),
          notify_security_events: get(`sec_${k}`),
          delivery_mode: 'immediate',
        }
      })
      await api('/api/notifications/preferences', { method: 'PUT', body: { prefs: out } })
      toast('OK', 'Preferencias salvas.')
    }
  }

  if (mobileCards) {
    mobileCards.querySelectorAll('input[type="checkbox"]').forEach((el) => {
      el.disabled = !canUpdate
    })
  }
}
