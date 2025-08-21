import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/info-kits
router.get('/', async (req, res) => {
  try {
    const infoKits = await prisma.infoKit.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        fileUrl: true,
        imageUrl: true,
        language: true,
        createdAt: true
      }
    });
    res.json(infoKits);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/info-kits
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, description, fileUrl, imageUrl, language } = req.body;

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
    const newInfoKit = await prisma.infoKit.create({
      data: { title, description, fileUrl, imageUrl, language },
      select: { id: true, title: true, language: true }
    });
    res.status(201).json(newInfoKit);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/info-kits/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide' });
  }

  try {
    await prisma.infoKit.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Info kit supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Info kit non trouvé' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;