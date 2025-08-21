import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/communiques
router.get('/', async (req, res) => {
  try {
    const communiques = await prisma.communique.findMany({
      orderBy: { date: 'desc' },
      select: {
        id: true,
        title: true,
        content: true,
        date: true,
        fileUrl: true,
        isImportant: true,
        createdAt: true
      }
    });
    res.json(communiques);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la récupération',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/communiques
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, content, date, fileUrl, isImportant } = req.body;

  if (!title || !content || !date) {
    return res.status(400).json({ 
      message: 'Le titre, le contenu et la date sont requis',
      errors: {
        title: !title ? 'Requis' : undefined,
        content: !content ? 'Requis' : undefined,
        date: !date ? 'Requis' : undefined
      }
    });
  }

  // Correction ici : conversion de isImportant en booléen
  const isImportantBoolean = isImportant === 'true';

  try {
    const newCommunique = await prisma.communique.create({
      data: { 
        title, 
        content, 
        date: new Date(date), 
        fileUrl, 
        isImportant: isImportantBoolean
      },
      select: { id: true, title: true, date: true }
    });
    res.status(201).json(newCommunique);
  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/communiques/:id
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;

  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide' });
  }

  try {
    await prisma.communique.delete({
      where: { id: parseInt(id) }
    });
    res.json({ message: 'Communiqué supprimé avec succès' });
  } catch (error) {
    console.error('Erreur:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Communiqué non trouvé' });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;