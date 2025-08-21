import { Router } from 'express'
import pkg from '@prisma/client'
import { requireAuth, requireRole } from '../middleware/auth.js'

const { PrismaClient, Role } = pkg
const prisma = new PrismaClient()
const router = Router()

router.get('/', async (_req,res)=>{
  const items = await prisma.project.findMany({ include: { company:true } })
  res.json(items)
})

router.post('/', requireAuth, requireRole('ADMIN','MANAGER'), async (req,res)=>{
  const { title, status, budget, companySlug } = req.body
  const company = await prisma.company.findUnique({ where: { slug: companySlug } })
  if(!company) return res.status(400).json({ error: 'Bad company' })
  const proj = await prisma.project.create({ data: { title, status, budget: budget ? Number(budget) : null, companyId: company.id } })
  res.json(proj)
})

export default router
