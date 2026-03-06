# LIÇÕES APRENDIDAS (NazcaTraker)

Gerado automaticamente a partir de sinais no codigo. Complementar manualmente quando necessario.

- Migrations devem ser defensivas (checar colunas antes de ALTER/INDEX) para nao quebrar o start.
- Contrato excedido: compra pode ficar como null; decidir regra de bloqueio vs apenas sinalizacao.
- Validacao e centralizada em Zod via middleware (body/query/params).
- ZodError retorna 400 com details (path/message); padronizar tratamento no frontend.
