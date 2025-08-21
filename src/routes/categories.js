import { Router } from 'express';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

// Route pour récupérer toutes les catégories
router.get('/', async (_req, res) => {
    try {
        const categories = await prisma.category.findMany({
            orderBy: { name: 'asc' },
        });
        res.json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Failed to fetch categories.' });
    }
});

// Route pour créer une nouvelle catégorie
router.post('/', async (req, res) => {
  const { name } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Category name is required.' });
  }

  try {
    const newCategory = await prisma.category.create({
      data: { name },
    });
    res.status(201).json(newCategory);
  } catch (error) {
    console.error('Error creating category:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Category with this name already exists.', code: 'P2002' });
    }
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

// ✅ Nouvelle route pour supprimer une catégorie
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);

    // Vérifier si l'ID est un nombre valide
    if (isNaN(id)) {
        return res.status(400).json({ error: 'Invalid category ID.' });
    }

    try {
        // Supprimer la catégorie
        await prisma.category.delete({
            where: { id },
        });
        // Renvoyer une réponse 204 (No Content) pour indiquer le succès de la suppression
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting category:', error);
        // Gérer l'erreur si la catégorie n'est pas trouvée (code Prisma P2025)
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'Category not found.' });
        }
        res.status(500).json({ error: 'Failed to delete category.' });
    }
});

export default router;