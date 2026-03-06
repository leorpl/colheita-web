import { Router } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const pagesRouter = Router()

function publicFile(res, file) {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  res.sendFile(path.join(__dirname, '..', 'public', file))
}

pagesRouter.get('/', (_req, res) => {
  publicFile(res, 'index.html')
})

pagesRouter.get('/login', (_req, res) => {
  publicFile(res, 'login.html')
})

pagesRouter.get('/forgot', (_req, res) => {
  publicFile(res, 'forgot.html')
})

pagesRouter.get('/reset', (_req, res) => {
  publicFile(res, 'reset.html')
})

// Site institucional (publico)
pagesRouter.get('/institucional', (_req, res) => {
  publicFile(res, path.join('institucional', 'index.html'))
})
pagesRouter.get('/institucional/sobre', (_req, res) => {
  publicFile(res, path.join('institucional', 'sobre.html'))
})
pagesRouter.get('/institucional/producao', (_req, res) => {
  publicFile(res, path.join('institucional', 'producao.html'))
})
pagesRouter.get('/institucional/tecnologia', (_req, res) => {
  publicFile(res, path.join('institucional', 'tecnologia.html'))
})
pagesRouter.get('/institucional/galeria', (_req, res) => {
  publicFile(res, path.join('institucional', 'galeria.html'))
})
pagesRouter.get('/institucional/contato', (_req, res) => {
  publicFile(res, path.join('institucional', 'contato.html'))
})
