import { Router } from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const pagesRouter = Router()

pagesRouter.get('/', (_req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'))
})

pagesRouter.get('/login', (_req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  res.sendFile(path.join(__dirname, '..', 'public', 'login.html'))
})

pagesRouter.get('/forgot', (_req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  res.sendFile(path.join(__dirname, '..', 'public', 'forgot.html'))
})

pagesRouter.get('/reset', (_req, res) => {
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  res.sendFile(path.join(__dirname, '..', 'public', 'reset.html'))
})
