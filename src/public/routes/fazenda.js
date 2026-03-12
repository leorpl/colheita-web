export async function renderFazendaRoute({ activeNav, setView, escapeHtml, fazendaPublic } = {}) {
  if (typeof activeNav !== 'function') throw new Error('activeNav obrigatorio')
  if (typeof setView !== 'function') throw new Error('setView obrigatorio')
  if (typeof escapeHtml !== 'function') throw new Error('escapeHtml obrigatorio')

  activeNav('fazenda')
  const f = fazendaPublic
  const mapsEmbed = 'https://www.google.com/maps/d/embed?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&ehbc=2E312F'
  const mapsOpen = 'https://www.google.com/maps/d/edit?mid=1I31t4h-O1Scw04_yJqcTAs8EqUid5IE&ll=-20.193727536387307%2C-45.874922749999996&z=17'
  setView(`
    <section class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">${escapeHtml(f.nome)}</div>
          <div class="panel-sub">Informacoes internas + links publicos (redes sociais e Google Maps).</div>
        </div>
      </div>
      <div class="panel-body">
        <div class="grid">
          <div class="span12" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap">
            <img src="/logo.png" alt="${escapeHtml(f.nome)}" style="width:140px;height:140px;object-fit:contain;background:rgba(255,255,255,.75);border:1px solid rgba(15,26,22,.14);border-radius:18px;padding:14px" />
            <div>
              <div style="font-family:var(--serif);font-size:22px">NazcaTracker</div>
              <div style="margin-top:6px;color:var(--muted)">Base interna: colheita (safras, talhões, destinos, viagens, descontos e fretes).</div>
              <div style="margin-top:10px" class="pill"><span class="dot warn"></span><span>Fontes publicas: Google Maps / Instagram / Facebook.</span></div>
            </div>
          </div>

          <div class="span6">
            <div class="stat">
              <div class="stat-k">Localizacao (Google Maps)</div>
              <div class="stat-v" style="font-size:16px">${escapeHtml(f.localizacao.endereco)}</div>
              <div class="stat-h">Plus Code: <span class="mono">${escapeHtml(f.localizacao.plus_code)}</span></div>
              <div class="stat-h">Avaliacao: ${escapeHtml(f.localizacao.maps_rating)} (${escapeHtml(f.localizacao.maps_reviews)} avaliacoes)</div>
              <div style="margin-top:10px">
                <a class="btn small ghost" href="${escapeHtml(f.localizacao.maps_url)}" target="_blank" rel="noreferrer">Abrir no Maps</a>
              </div>
            </div>
          </div>

          <div class="span6">
            <div class="stat">
              <div class="stat-k">Redes sociais</div>
              <div class="stat-h"><a href="${escapeHtml(f.links.instagram)}" target="_blank" rel="noreferrer">Instagram: @fazendanazca</a></div>
              <div class="stat-h"><a href="${escapeHtml(f.links.facebook)}" target="_blank" rel="noreferrer">Facebook: /fazendanazca</a></div>
              <div class="stat-h"><a href="${escapeHtml(f.links.reel)}" target="_blank" rel="noreferrer">Reel (Instagram)</a></div>
              <div class="stat-h">Obs: a leitura automática do conteúdo pode falhar por bloqueios das plataformas.</div>
            </div>
          </div>

          <div class="span12">
            <div class="stat">
              <div class="stat-k">Sobre (interno)</div>
              <div class="stat-h">Objetivo: registrar viagens de colheita, aplicar descontos (umidade/qualidade), calcular sacas/fretes/secagem e gerar relatórios por safra.</div>
              <div class="stat-h" style="margin-top:10px"><b>Rotina sugerida</b>: cadastrar fretes/regras do destino no início da safra; lançar colheita na saída; completar entrega no silo quando houver (romaneio, tara/peso, análise).</div>
              <div class="stat-h" style="margin-top:10px"><b>Padrões</b>: percentuais sempre 0..100; umidade/qualidade conforme amostra do silo; revisão semanal do % de área colhida por talhão.</div>
            </div>
          </div>

          <div class="span12">
            <div class="stat">
              <div class="stat-k">Mapa dos talhões (My Maps)</div>
              <div class="mini-map" style="margin-top:10px">
                <iframe title="Mapa dos talhões" loading="lazy" src="${escapeHtml(mapsEmbed)}"></iframe>
              </div>
              <div style="margin-top:10px">
                <a class="btn small ghost" href="${escapeHtml(mapsOpen)}" target="_blank" rel="noreferrer">Abrir mapa</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  `)
}
