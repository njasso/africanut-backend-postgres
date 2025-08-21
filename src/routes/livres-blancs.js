import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ---------------------
// GET /api/livre-blanc
// ---------------------
router.get('/', async (req, res) => {
  try {
    const livresBlancs = await prisma.livreBlanc.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        fileUrl: true,
        category: true,
        createdAt: true,
        updatedAt: true
      }
    });
    res.json(livresBlancs);
  } catch (error) {
    console.error('Erreur récupération livres blancs:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération des livres blancs',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---------------------
// GET /api/livre-blanc/:id
// ---------------------
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const livre = await prisma.livreBlanc.findUnique({
      where: { id: parseInt(id) }
    });
    if (!livre) return res.status(404).json({ message: 'Livre blanc non trouvé' });
    res.json(livre);
  } catch (error) {
    console.error('Erreur récupération livre blanc:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération du livre blanc',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---------------------
// POST /api/livre-blanc
// ---------------------
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, description, fileUrl, category, imageUrl } = req.body;

  if (!title || !fileUrl) {
    return res.status(400).json({ 
      message: 'Le titre et l\'URL du fichier sont requis',
      errors: {
        title: !title ? 'Requis' : undefined,
        fileUrl: !fileUrl ? 'Requis' : undefined
      }
    });
  }

  // Convertir la chaîne de catégorie en tableau si elle existe
  const categoryArray = (category && typeof category === 'string')
    ? category.split(',').map(s => s.trim())
    : category;

  try {
    const newLivreBlanc = await prisma.livreBlanc.create({
      data: { 
        title, 
        description, 
        fileUrl, 
        category: categoryArray, 
        imageUrl 
      },
      select: { id: true, title: true, fileUrl: true, imageUrl: true, category: true }
    });
    res.status(201).json(newLivreBlanc);
  } catch (error) {
    console.error('Erreur création livre blanc:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---------------------
// PUT /api/livre-blanc/:id
// ---------------------
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { title, description, fileUrl, category, imageUrl } = req.body;

  // Convertir la chaîne de catégorie en tableau si elle existe
  const categoryArray = (category && typeof category === 'string')
    ? category.split(',').map(s => s.trim())
    : category;

  try {
    const updatedLivre = await prisma.livreBlanc.update({
      where: { id: parseInt(id) },
      data: { 
        title, 
        description, 
        fileUrl, 
        category: categoryArray, 
        imageUrl 
      }
    });
    res.json(updatedLivre);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Livre blanc non trouvé' });
    console.error('Erreur mise à jour livre blanc:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la mise à jour',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// ---------------------
// DELETE /api/livre-blanc/:id
// ---------------------
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) return res.status(400).json({ message: 'ID invalide' });

  try {
    await prisma.livreBlanc.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Livre blanc supprimé avec succès' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Livre blanc non trouvé' });
    console.error('Erreur suppression livre blanc:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;