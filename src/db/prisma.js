import { PrismaClient } from '../generated/prisma/index.js'

let prismaSingleton

export function prismaClient() {
  if (!prismaSingleton) {
    prismaSingleton = new PrismaClient()
  }
  return prismaSingleton
}
