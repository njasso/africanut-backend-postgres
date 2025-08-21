import express from "express";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const router = express.Router();
const prisma = new PrismaClient();

// ✅ Schéma de validation des commandes
const orderSchema = z.object({
  companyId: z.string().uuid(),
  userId: z.string().uuid().optional(),
  shippingAddress: z.string(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().min(1),
      priceAtPurchase: z.number().min(0), // Le prix est maintenant validé
    })
  ).min(1),
});

/**
 * 📌 Créer une nouvelle commande
 * Accessible même sans userId
 */
router.post("/", async (req, res) => {
  try {
    // Validation
    const parseResult = orderSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.format() });
    }
    const { companyId, userId, shippingAddress, items } = parseResult.data;

    // Vérifier la société
    const company = await prisma.company.findUnique({ where: { id: companyId } });
    if (!company) return res.status(404).json({ error: "Société introuvable." });

    // Vérifier l'utilisateur si fourni
    let finalUserId = null;
    if (userId) {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) return res.status(404).json({ error: "Utilisateur introuvable." });
      finalUserId = user.id;
    }
    
    // Récupérer tous les produits en une seule query et les stocker dans un objet pour un accès facile
    const productIds = items.map((i) => i.productId);
    const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
    const productMap = new Map(products.map(p => [p.id, p]));

    // Créer un tableau d'items d'ordre pour la création dans la BDD
    const orderItemsToCreate = [];
    for (const item of items) {
      const product = productMap.get(item.productId);
      if (!product) {
        return res.status(404).json({ error: `Produit introuvable pour l'ID: ${item.productId}` });
      }
      
      // ✅ Nouvelle vérification pour s'assurer que le stock est un nombre valide
      if (typeof product.stock_quantity !== 'number' || !Number.isFinite(product.stock_quantity)) {
          return res.status(500).json({ error: `Données de stock invalides pour le produit: ${product.name}` });
      }

      if (product.stock_quantity < item.quantity) {
        return res.status(400).json({ error: `Stock insuffisant pour ${product.name}.` });
      }
      
      // Ajouter l'item au tableau avec les champs requis
      orderItemsToCreate.push({
        productId: item.productId,
        quantity: item.quantity,
        priceAtPurchase: item.priceAtPurchase,
      });
    }

    // Calculer le total en utilisant le tableau d'items prêt pour la BDD
    let totalAmount = orderItemsToCreate.reduce((sum, item) => sum + item.priceAtPurchase * item.quantity, 0);

    // ✅ Correction de la précision du montant total
    totalAmount = parseFloat(totalAmount.toFixed(2));

    // ✅ Vérification de sécurité: s'assurer que le montant total est un nombre valide
    if (isNaN(totalAmount) || !isFinite(totalAmount)) {
        return res.status(400).json({ error: "Le montant total de la commande n'est pas un nombre valide." });
    }


    // Transaction : création commande, mise à jour stock et mouvements
    const savedOrder = await prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          companyId,
          userId: finalUserId,
          shippingAddress,
          totalAmount,
          items: { create: orderItemsToCreate }
        },
        include: { items: { include: { product: true } } }
      });

      // Décrémenter le stock et créer les mouvements
      for (const item of order.items) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock_quantity: { decrement: item.quantity } }
        });

        // ✅ Correction de l'erreur: Utiliser orderItemId pour lier le mouvement à l'article de la commande
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: item.quantity,
            type: "sale",
            orderItemId: item.id // Utiliser l'ID de l'article de la commande
          }
        });
      }

      return order;
    });

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error("Erreur création commande:", error);

    if (error.code === "P2003") {
      return res.status(400).json({ error: "Clé étrangère invalide (companyId, userId, productId)." });
    }

    if (error.code === "P2025") {
      return res.status(404).json({ error: "Commande introuvable pour mise à jour/suppression." });
    }

    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }

    res.status(500).json({ error: "Erreur serveur." });
  }
});

/**
 * 📌 Récupérer toutes les commandes
 */
router.get("/", async (req, res) => {
  try {
    const orders = await prisma.order.findMany({
      include: {
        items: { include: { product: true } },
        company: true,
        user: true
      },
      orderBy: { createdAt: "desc" }
    });
    res.json(orders);
  } catch (error) {
    console.error("Erreur récupération commandes:", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

/**
 * 📌 Récupérer une commande par ID
 */
router.get("/:id", async (req, res) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: { include: { product: true } },
        company: true,
        user: true
      }
    });

    if (!order) return res.status(404).json({ error: "Commande introuvable." });

    res.json(order);
  } catch (error) {
    console.error("Erreur récupération commande:", error);
    res.status(500).json({ error: "Erreur serveur." });
  }
});

/**
 * 📌 Mettre à jour une commande (status, paiement, adresse)
 */
router.put("/:id", async (req, res) => {
  try {
    const { status, paymentStatus, shippingAddress } = req.body;
    const order = await prisma.order.update({
      where: { id: req.params.id },
      data: { status, paymentStatus, shippingAddress }
    });
    res.json(order);
  } catch (error) {
    console.error("Erreur mise à jour commande:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Commande introuvable." });
    }
    res.status(500).json({ error: "Erreur serveur." });
  }
});

/**
 * 📌 Supprimer une commande
 */
router.delete("/:id", async (req, res) => {
  try {
    await prisma.order.delete({ where: { id: req.params.id } });
    res.json({ message: "Commande supprimée." });
  } catch (error) {
    console.error("Erreur suppression commande:", error);
    if (error.code === "P2025") {
      return res.status(404).json({ error: "Commande introuvable." });
    }
    res.status(500).json({ error: "Erreur serveur." });
  }
});

export default router;
