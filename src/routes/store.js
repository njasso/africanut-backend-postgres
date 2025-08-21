// src/routes/store.js
import { Router } from 'express';
import pkg from '@prisma/client'

const { PrismaClient, Role } = pkg
const router = Router();
const prisma = new PrismaClient();

// Route pour enregistrer une commande
router.post('/orders', async (req, res) => {
  const { companySlug, cart } = req.body;

  if (!companySlug || !cart || cart.length === 0) {
    return res.status(400).json({ message: 'Données de commande invalides.' });
  }

  try {
    const newOrder = await prisma.order.create({
      data: {
        companySlug: companySlug,
        orderDetails: JSON.stringify(cart), // Convertit le panier en chaîne JSON
      },
    });

    res.status(201).json({ 
      message: 'Commande enregistrée avec succès.',
      order: newOrder 
    });
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de la commande:', error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

export default router;