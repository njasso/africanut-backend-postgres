// backend/routes/reports.js
import { Router } from 'express'
import pkg from '@prisma/client'
import ExcelJS from 'exceljs'
import PDFDocument from 'pdfkit'
import { Parser as CsvParser } from 'json2csv'
import { requireAuth } from '../middleware/auth.js'

const { PrismaClient } = pkg
const prisma = new PrismaClient()
const router = Router()

/**
 * Helper : récupérer les écritures comptables avec filtres optionnels
 */
async function getAccountingEntries({ companySlug, startDate, endDate }) {
  const where = {}
  if (companySlug) where.company = { slug: companySlug }
  if (startDate || endDate) {
    where.date = {}
    if (startDate) where.date.gte = new Date(startDate)
    if (endDate) where.date.lte = new Date(endDate)
  }

  return prisma.accountingEntry.findMany({
    where,
    include: { company: true },
    orderBy: { date: 'desc' }
  })
}

/**
 * Helper: Calculer les totaux pour le compte de résultat
 */
function calculatePnl(entries) {
  const produits = entries.filter(e => e.type === 'PRODUCT').reduce((sum, e) => sum + e.amount, 0)
  const charges = entries.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0)
  return { produits, charges, benefice: produits - charges }
}

/**
 * Helper: Calculer les totaux pour le bilan (simplifié)
 */
function calculateBalanceSheet(entries) {
  const solde = entries.filter(e => e.type === 'PRODUCT').reduce((sum, e) => sum + e.amount, 0) -
                entries.filter(e => e.type === 'EXPENSE').reduce((sum, e) => sum + e.amount, 0)
  return { actif: solde, passif: solde }
}

/**
 * Export Excel
 */
router.get('/accounting.xlsx', requireAuth, async (req, res) => {
  try {
    const { companySlug, startDate, endDate } = req.query
    const entries = await getAccountingEntries({ companySlug, startDate, endDate })

    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Comptabilité')
    worksheet.addRow(['Date', 'Type', 'Libellé', 'Montant', 'Entreprise'])

    entries.forEach(e => {
      worksheet.addRow([
        e.date.toISOString().split('T')[0],
        e.type === 'PRODUCT' ? 'Produit' : 'Charge',
        e.label || '',
        e.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' }),
        e.company ? e.company.name : '❌ Introuvable'
      ])
    })

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    )
    res.setHeader('Content-Disposition', 'attachment; filename="accounting.xlsx"')
    await workbook.xlsx.write(res)
    res.end()
  } catch (err) {
    console.error('Erreur Excel:', err)
    res.status(500).json({ error: 'Erreur export Excel' })
  }
})

/**
 * Export CSV
 */
router.get('/accounting.csv', requireAuth, async (req, res) => {
  try {
    const { companySlug, startDate, endDate } = req.query
    const entries = await getAccountingEntries({ companySlug, startDate, endDate })

    const data = entries.map(e => ({
      Date: e.date.toISOString().split('T')[0],
      Type: e.type === 'PRODUCT' ? 'Produit' : 'Charge',
      Libelle: e.label,
      Montant: e.amount,
      Entreprise: e.company ? e.company.name : '❌ Introuvable'
    }))

    const csv = new CsvParser().parse(data)

    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="accounting.csv"')
    res.send(csv)
  } catch (err) {
    console.error('Erreur CSV:', err)
    res.status(500).json({ error: 'Erreur export CSV' })
  }
})

/**
 * Export PDF (Transactions)
 */
router.get('/accounting.pdf', requireAuth, async (req, res) => {
  try {
    const { companySlug, startDate, endDate } = req.query
    const entries = await getAccountingEntries({ companySlug, startDate, endDate })

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="accounting.pdf"')

    const doc = new PDFDocument({ margin: 40 })
    doc.pipe(res)

    doc.fontSize(18).text('Comptabilité', { underline: true })
    doc.moveDown()

    entries.forEach(e => {
      const dateStr = (e.date instanceof Date) ? e.date.toISOString().split('T')[0] : 'Date inconnue'
      const labelStr = e.label || ''
      const amountStr = e.amount ? e.amount.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' }) : 'Montant inconnu'
      const companyStr = e.company ? e.company.name : '❌ Introuvable'

      doc
        .fontSize(12)
        .text(
          `${dateStr} | ${e.type === 'PRODUCT' ? 'Produit' : 'Charge'} | ${labelStr} | ${amountStr} | ${companyStr}`
        )
    })

    doc.end()
  } catch (err) {
    console.error('Erreur PDF:', err)
    res.status(500).json({ error: 'Erreur export PDF' })
  }
})

/**
 * Export PDF (Compte de Résultat)
 */
router.get('/pnl.pdf', requireAuth, async (req, res) => {
  try {
    const { companySlug, startDate, endDate } = req.query
    const entries = await getAccountingEntries({ companySlug, startDate, endDate })
    const pnl = calculatePnl(entries)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="pnl.pdf"')

    const doc = new PDFDocument({ margin: 40 })
    doc.pipe(res)

    doc.fontSize(18).text('Compte de Résultat', { underline: true })
    doc.moveDown()
    
    doc.fontSize(12).text(`Total des produits: ${pnl.produits.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}`)
    doc.text(`Total des charges: ${pnl.charges.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}`)
    doc.text(`Bénéfice net: ${pnl.benefice.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}`)

    doc.end()
  } catch (err) {
    console.error('Erreur PnL PDF:', err)
    res.status(500).json({ error: 'Erreur export PnL PDF' })
  }
})

/**
 * Export PDF (Bilan)
 */
router.get('/balance-sheet.pdf', requireAuth, async (req, res) => {
  try {
    const { companySlug, startDate, endDate } = req.query
    const entries = await getAccountingEntries({ companySlug, startDate, endDate })
    const balanceSheet = calculateBalanceSheet(entries)

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', 'attachment; filename="balance-sheet.pdf"')

    const doc = new PDFDocument({ margin: 40 })
    doc.pipe(res)

    doc.fontSize(18).text('Bilan (Simplifié)', { underline: true })
    doc.moveDown()

    doc.fontSize(12).text(`Total Actif: ${balanceSheet.actif.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}`)
    doc.text(`Total Passif: ${balanceSheet.passif.toLocaleString('fr-FR', { style: 'currency', currency: 'XAF' })}`)

    doc.end()
  } catch (err) {
    console.error('Erreur Bilan PDF:', err)
    res.status(500).json({ error: 'Erreur export Bilan PDF' })
  }
})

export default router
