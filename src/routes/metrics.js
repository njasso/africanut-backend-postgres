import { Router } from 'express'
import pkg from '@prisma/client'
import { requireAuth } from '../middleware/auth.js'

const { PrismaClient, Role } = pkg
const prisma = new PrismaClient()
const router = Router()

router.get('/', requireAuth, async (_req,res)=>{
  const items = await prisma.metric.findMany({ orderBy: { date: 'desc' } })
  res.json(items)
})

router.post('/', requireAuth, async (req,res)=>{
  const { companySlug, lot, biomassKg, feedKg, productionKg, mortalities, note } = req.body
  const company = await prisma.company.findUnique({ where: { slug: companySlug } })
  if(!company) return res.status(400).json({ error:'Bad company' })
  const fcr = productionKg > 0 ? Number(feedKg) / Number(productionKg) : null
  const m = await prisma.metric.create({ data: {
    companyId: company.id, lot, biomassKg: Number(biomassKg), feedKg: Number(feedKg),
    productionKg: Number(productionKg), mortalities: mortalities ? Number(mortalities) : null, note, fcr
  }})
  res.json(m)
})

router.get('/summary', requireAuth, async (_req,res)=>{
  const rows = await prisma.metric.findMany()
  const totalFeed = rows.reduce((s,r)=>s+r.feedKg,0)
  const totalProd = rows.reduce((s,r)=>s+r.productionKg,0)
  const avgFcr = totalProd>0 ? totalFeed/totalProd : null
  const biomass = rows.reduce((s,r)=>s+r.biomassKg,0)
  res.json({ biomass, totalFeed, totalProd, avgFcr })
})

export default router
