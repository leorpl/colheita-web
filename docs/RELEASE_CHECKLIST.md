# RELEASE CHECKLIST

Checklist operacional para deploy do NazcaTraker. Atualizado automaticamente; complemente com detalhes do ambiente quando necessario.

## Pré-deploy

1. Fazer backup do banco SQLite (`DB_PATH`).
2. Confirmar variáveis de ambiente do `.env` / `.env.example` e defaults seguros.
3. Rodar `npm install` e validar dependências novas/removidas.
4. Rodar `npm test`.
5. Rodar `npm run context:check`.
6. Revisar `docs/PROJECT_CONTEXT.md`, `docs/ARCHITECTURE.md` e `docs/LIÇÕESAPRENDIDAS.MD`.

## Banco / SQLite

- Banco atual: SQLite (34 tabelas detectadas).
- Confirmar path de `DB_PATH`, permissão de escrita e espaço em disco.
- Evitar operações destrutivas sem backup validado.

## Rotas críticas para smoke test

- [x] /api/auth/login
- [x] /api/auth/reset
- [x] /api/users
- [x] /api/viagens
- [x] /api/relatorios
- [x] /api/contratos-silo
- [x] /api/talhoes
- [x] /api/fretes
- [x] /api/audit-logs

## Segurança

- Confirmar autenticação, troca/reset de senha, permissões e cookies seguros.
- Revisar uploads críticos (contratos, georreferenciamento, exportações) e limites de arquivo.
- Garantir ausência de segredos hardcoded e revisão do `.env.example`.

## Deploy

1. Fazer pull da versão.
2. Instalar dependências.
3. Reiniciar o processo (`npm start`, PM2 ou serviço equivalente).
4. Validar login e fluxo principal de colheita.
5. Validar relatórios, exportações e uploads.
6. Validar auditoria e mensagens de erro em modais/dialogs.

## Status sugerido

- `PRONTO PARA DEPLOY` quando checklist estiver verde e sem bloqueios críticos.
- `ATENÇÃO NECESSÁRIA` quando houver pendências importantes mas controladas.
- `DEPLOY NÃO RECOMENDADO` quando houver falha em testes, contexto ou rotas críticas.
