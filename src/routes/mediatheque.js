import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/mediatheque
router.get('/', async (req, res) => {
  try {
    const medias = await prisma.media.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        type: true, // 'image', 'video', 'document'
        url: true,
        thumbnailUrl: true,
        category: true,
        createdAt: true
      }
    });
    res.json(medias);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/mediatheque
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, description, type, url, thumbnailUrl, category } = req.body;

  if (!title || !type || !url) {
    return res.status(400).json({ 
      message: 'Le titre, le type et l\'URL sont requis',
      errors: {
        title: !title ? 'Requis' : undefined,
        type: !type ? 'Requis' : undefined,
        url: !url ? 'Requis' : undefined
      }
    });
  }

  // Correction ici : convertir la chaîne de catégorie en tableau si elle existe
  const categoryArray = (category && typeof category === 'string')
    ? category.split(',').map(s => s.trim())
    : category;

  try {
    const newMedia = await prisma.media.create({
      data: { 
        title, 
        description, 
        type, 
        url, 
        thumbnailUrl, 
        category: categoryArray
      },
      select: { id: true, title: true, type: true }
    });
    res.status(201).json(newMedia);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/mediatheque/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide' });
  }

  try {
    await prisma.media.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Média supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Média non trouvé' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;