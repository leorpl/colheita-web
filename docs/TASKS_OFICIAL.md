# TASKS_OFICIAL.md

Gerado/atualizado automaticamente quando necessario pelo self-heal do projeto.

## Prioridade Alta
- [ ] Decidir e implementar o comportamento quando a entrega excede o contrato (hoje salva e apenas zera `valor_compra_*`)
- [ ] Cobrir com testes os cenarios criticos de colheita/contrato/trava/rateio (node --test)

## Prioridade Media
- [ ] Ajustar scripts/seed-from-planilha.js: script referencia destino.trava_sacas (coluna nao existe no schema atual)
- [ ] Avaliar rate limit em ambiente multi-instancia (hoje e por processo, em memoria)

## Backlog
- [ ] Considerar mover `sharp` para devDependency (no codigo atual aparece apenas em scripts)

Somente tarefas listadas aqui sao consideradas pendentes.
