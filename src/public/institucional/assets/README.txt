Fotos e assets do site institucional

Pastas
- assets/: placeholders e arquivos auxiliares
- assets/photos/: coloque as fotos reais aqui

Como trocar os placeholders por fotos reais
1) Coloque uma foto forte do "hero" em: assets/photos/hero.webp
2) Coloque 2 fotos amplas para blocos em: assets/photos/wide-1.webp e assets/photos/wide-2.webp
3) Coloque fotos para galeria em: assets/photos/gallery-01.webp ... gallery-12.webp (ou as que voce definir em gallery.json)
4) Ajuste as legendas em: ../gallery.json

Recomendacoes (performance)
- Formato: WebP (preferencia). JPG como fallback se necessario.
- Dimensoes sugeridas:
  - hero.webp: 2200x1400 (ou maior, mantendo proporcao)
  - wide-*.webp: 1600x1000
  - gallery-*.webp: 1600x1200
- Tamanho: tente manter <= 250KB por imagem.

Observacao
- O site atual usa SVG placeholders. Quando as fotos existirem, voce pode:
  - apenas adicionar as fotos na pasta assets/photos/ (o JS troca automaticamente quando elas existirem)
  - para galeria, mantenha a lista em gallery.json
