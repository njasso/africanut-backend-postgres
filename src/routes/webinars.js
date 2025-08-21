import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// GET /api/webinars - Récupère tous les webinaires
router.get('/', async (req, res) => {
    try {
        const webinars = await prisma.webinar.findMany({
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                title: true,
                description: true,
                videoUrl: true,
                // ✅ Ajout du champ d'image
                coverImageUrl: true, 
                createdAt: true,
                updatedAt: true
            }
        });
        res.json(webinars);
    } catch (error) {
        // ... (gestion des erreurs inchangée)
    }
});

// POST /api/webinars - Crée un nouveau webinaire
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
    // ✅ Ajout de coverImageUrl dans la déstructuration
    const { title, description, videoUrl, coverImageUrl } = req.body;
    
    // ✅ Ajout de la validation pour le champ d'image (optionnel)
    if (!title || !description || !videoUrl || !coverImageUrl) {
      return res.status(400).json({ 
        message: 'Le titre, la description, l\'URL de la vidéo et l\'URL de l\'image sont requis.',
        errors: {
          title: !title ? 'Requis' : undefined,
          description: !description ? 'Requis' : undefined,
          videoUrl: !videoUrl ? 'Requis' : undefined,
          coverImageUrl: !coverImageUrl ? 'Requis' : undefined
        }
      });
    }

    try {
        const newWebinar = await prisma.webinar.create({
            data: { 
                title, 
                description, 
                videoUrl,
                // ✅ Ajout de coverImageUrl aux données
                coverImageUrl 
            },
            select: {
                id: true,
                title: true,
                description: true,
                videoUrl: true,
                coverImageUrl: true, // ✅ Ajout pour la réponse
                createdAt: true
            }
        });
        res.status(201).json(newWebinar);
    } catch (error) {
    console.error('Erreur lors de la création du webinaire:', error);
    res.status(500).json({ 
      message: 'Erreur lors de la création du webinaire.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// DELETE /api/webinars/:id - Supprime un webinaire
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  
  // Validation de l'ID
  if (isNaN(parseInt(id))) {
    return res.status(400).json({ message: 'ID invalide.' });
  }

  try {
    const deletedWebinar = await prisma.webinar.delete({
      where: { id: parseInt(id) },
      select: {
        id: true,
        title: true
      }
    });
    res.json({ 
      message: 'Webinaire supprimé avec succès.', 
      webinar: deletedWebinar 
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du webinaire:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({ 
        message: 'Webinaire non trouvé.' 
      });
    }
    
    res.status(500).json({ 
      message: 'Erreur lors de la suppression du webinaire.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;