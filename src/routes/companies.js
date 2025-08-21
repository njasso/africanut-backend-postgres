// src/routes/companies.js
import { Router } from 'express';
import pkg from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const { PrismaClient, Role } = pkg;
const prisma = new PrismaClient();
const router = Router();

// ---------------------------
// GET : liste de toutes les entreprises
// ---------------------------
router.get('/', async (_req, res) => {
  try {
    const companies = await prisma.company.findMany();
    res.json(companies);
  } catch (err) {
    console.error('Erreur GET /companies', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------
// GET : détails d'une entreprise avec projets et employés
// ---------------------------
router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const company = await prisma.company.findUnique({
      where: { slug },
      include: { projects: true, employees: true },
    });

    if (!company) return res.status(404).json({ error: 'Entreprise introuvable' });
    res.json(company);
  } catch (err) {
    console.error('Erreur GET /companies/:slug', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------
// GET : transactions d'une entreprise (avec filtres optionnels)
// ---------------------------
router.get('/:slug/transactions', async (req, res) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const { startDate, endDate, type } = req.query;

    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable' });

    const where = { companyId: company.id };
    if (type) where.type = type;
    if (startDate) where.date = { ...where.date, gte: new Date(startDate) };
    if (endDate) where.date = { ...where.date, lte: new Date(endDate) };

    const transactions = await prisma.accountingEntry.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { documents: true, createdBy: { select: { id: true, name: true, email: true } } }
    });

    res.json(transactions);
  } catch (err) {
    console.error('Erreur GET /companies/:slug/transactions', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------
// GET : résumé financier d'une entreprise
// ---------------------------
router.get('/:slug/summary', async (req, res) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable' });

    // Agrégats revenus / dépenses
    const revenusAgg = await prisma.accountingEntry.aggregate({
      where: { companyId: company.id, type: 'PRODUCT' },
      _sum: { amount: true },
    });
    const depensesAgg = await prisma.accountingEntry.aggregate({
      where: { companyId: company.id, type: 'EXPENSE' },
      _sum: { amount: true },
    });

    const revenus = revenusAgg._sum.amount || 0;
    const depenses = depensesAgg._sum.amount || 0;
    const solde = revenus - depenses;

    res.json({
      companyId: company.id,
      companySlug: company.slug,
      companyName: company.name,
      revenus,
      depenses,
      solde
    });
  } catch (err) {
    console.error('Erreur GET /companies/:slug/summary', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// ---------------------------
// PUT : mise à jour d'une entreprise (ADMIN / MANAGER)
// ---------------------------
router.put('/:slug', requireAuth, requireRole(Role.ADMIN, Role.MANAGER), async (req, res) => {
  try {
    const slug = req.params.slug?.toLowerCase().trim();
    const data = req.body;

    // Vérification existence
    const company = await prisma.company.findUnique({ where: { slug } });
    if (!company) return res.status(404).json({ error: 'Entreprise introuvable' });

    // Mise à jour sécurisée
    const updated = await prisma.company.update({
      where: { slug },
      data,
    });

    res.json(updated);
  } catch (err) {
    console.error('Erreur PUT /companies/:slug', err);
    res.status(400).json({ error: err.message });
  }
});

export default router;
