import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/brochures
router.get('/', async (req, res) => {
  try {
    const brochures = await prisma.brochure.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        imageUrl: true,
        fileUrl: true,
        language: true,
        createdAt: true
      }
    });
    res.json(brochures);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/brochures
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, description, imageUrl, fileUrl, language } = req.body;

  if (!title || !fileUrl) {
    return res.status(400).json({ 
      message: 'Le titre et l\'URL du fichier sont requis',
      errors: {
        title: !title ? 'Requis' : undefined,
        fileUrl: !fileUrl ? 'Requis' : undefined
      }
    });
  }

  try {
    const newBrochure = await prisma.brochure.create({
      data: { title, description, imageUrl, fileUrl, language },
      select: { id: true, title: true, language: true }
    });
    res.status(201).json(newBrochure);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/brochures/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide' });
  }

  try {
    await prisma.brochure.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Brochure supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Brochure non trouvée' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;