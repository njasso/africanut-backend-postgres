import { Router } from 'express';
import pkg from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

// --- GET : Récupérer tous les employés ---
router.get('/', requireAuth, async (req, res) => {
  try {
    const employees = await prisma.employee.findMany({
      include: { company: true }, // Inclut les infos de l'entreprise
      orderBy: { name: 'asc' }
    });
    res.json(employees);
  } catch (err) {
    console.error("Erreur GET /employees:", err);
    res.status(500).json({ error: 'Impossible de récupérer les employés.' });
  }
});

// --- POST : Créer un nouvel employé ---
router.post('/', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const {
    name, role, companySlug,
    date_of_birth, email, nationality,
    contract_type, phone, address, salary, photo_url
  } = req.body;

  if (!name || !role || !companySlug) {
    return res.status(400).json({ error: 'Champs obligatoires manquants.' });
  }

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) return res.status(400).json({ error: 'Entreprise invalide.' });

    const employee = await prisma.employee.create({
      data: {
        name,
        role,
        companyId: company.id,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        email: email || null,
        nationality: nationality || null,
        contract_type: contract_type || null,
        phone: phone || null,
        address: address || null,
        salary: salary ? Number(salary) : null,
        photo_url: photo_url || null
      }
    });

    res.json(employee);
  } catch (err) {
    console.error("Erreur POST /employees:", err);
    res.status(500).json({ error: 'Impossible de créer l’employé.' });
  }
});

// --- PUT : Mettre à jour un employé ---
router.put('/:id', requireAuth, requireRole('ADMIN', 'MANAGER'), async (req, res) => {
  const { id } = req.params;
  const {
    name, role, companySlug,
    date_of_birth, email, nationality,
    contract_type, phone, address, salary, photo_url
  } = req.body;

  try {
    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) return res.status(400).json({ error: 'Entreprise invalide.' });

    const updatedEmployee = await prisma.employee.update({
      where: { id },
      data: {
        name,
        role,
        companyId: company.id,
        date_of_birth: date_of_birth ? new Date(date_of_birth) : null,
        email: email || null,
        nationality: nationality || null,
        contract_type: contract_type || null,
        phone: phone || null,
        address: address || null,
        salary: salary ? Number(salary) : null,
        photo_url: photo_url || null
      }
    });

    res.json(updatedEmployee);
  } catch (err) {
    console.error("Erreur PUT /employees/:id:", err);
    res.status(404).json({ error: 'Employé non trouvé.' });
  }
});

// --- DELETE : Supprimer un employé ---
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    await prisma.employee.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    console.error("Erreur DELETE /employees/:id:", err);
    res.status(404).json({ error: 'Employé non trouvé.' });
  }
});

export default router;
