# Legado e Candidatos a Cleanup

Este arquivo lista pontos observados no codigo atual que indicam legado, compatibilidade ou possivel codigo morto.

## Tabelas legadas ainda presentes

- `destino_regra` e `umidade_faixa` ainda existem no schema (`src/db/migrate.js`) e aparecem em `src/repositories/destinoRegraRepo.js` e em scripts.
- O fluxo principal exposto na API/UI usa `destino_regra_plantio` e `umidade_faixa_plantio`.

## Scripts potencialmente desatualizados

- `scripts/seed-from-planilha.js` referencia `destino.trava_sacas`, mas o migrate remove essa coluna e reconstruiu a tabela `destino` sem ela.
- Scripts `override-umidade-*.js` operam em tabelas legadas (`destino_regra`/`umidade_faixa`) e precisam ser tratados como manutencao pontual.

## Dependencias

- `sharp` aparece no codigo apenas em `scripts/generate-favicons.js` (candidato a virar devDependency).
