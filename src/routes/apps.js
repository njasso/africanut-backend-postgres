import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/apps
router.get('/', async (req, res) => {
  try {
    const apps = await prisma.app.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        description: true,
        platform: true, // 'ios', 'android', 'web'
        downloadUrl: true,
        iconUrl: true,
        category: true,
        createdAt: true
      }
    });
    res.json(apps);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/apps
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { name, description, platform, downloadUrl, iconUrl, category } = req.body;

  if (!name || !platform || !downloadUrl) {
    return res.status(400).json({ 
      message: 'Le nom, la plateforme et l\'URL de téléchargement sont requis',
      errors: {
        name: !name ? 'Requis' : undefined,
        platform: !platform ? 'Requis' : undefined,
        downloadUrl: !downloadUrl ? 'Requis' : undefined
      }
    });
  }

  try {
    const newApp = await prisma.app.create({
      data: { name, description, platform, downloadUrl, iconUrl, category },
      select: { id: true, name: true, platform: true }
    });
    res.status(201).json(newApp);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/apps/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide' });
  }

  try {
    await prisma.app.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'App supprimée avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'App non trouvée' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;