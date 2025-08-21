import { Router } from 'express';
import pkg from '@prisma/client';

const { PrismaClient } = pkg;
const router = Router();
const prisma = new PrismaClient();

// =================================================================
// 🔍 Validation des données produit
// =================================================================
const validateProductData = (data, isUpdate = false) => {
  const errors = {};

  if (!isUpdate || data.name !== undefined) {
    if (!data.name?.trim()) errors.name = 'Product name is required';
  }

  if (!isUpdate || data.price !== undefined) {
    if (data.price === undefined || isNaN(Number(data.price))) {
      errors.price = 'Valid price is required';
    }
  }

  if (!isUpdate || data.stock_quantity !== undefined) {
    if (
      data.stock_quantity === undefined ||
      isNaN(Number(data.stock_quantity)) ||
      Number(data.stock_quantity) < 0
    ) {
      errors.stock_quantity = 'Valid stock quantity is required';
    }
  }

  if (!isUpdate || data.categoryId !== undefined) {
    if (!data.categoryId || typeof data.categoryId !== 'string') {
      errors.categoryId = 'Valid category ID is required';
    }
  }

  if (data.photos !== undefined) {
    if (!Array.isArray(data.photos)) {
      errors.photos = 'Photos must be an array';
    }
  }

  if (data.characteristics !== undefined) {
    if (typeof data.characteristics === 'string') {
      try {
        JSON.parse(data.characteristics || '{}');
      } catch {
        errors.characteristics = 'Invalid JSON format';
      }
    } else if (typeof data.characteristics !== 'object') {
      errors.characteristics = 'Invalid characteristics format';
    }
  }

  return Object.keys(errors).length ? errors : null;
};

// =================================================================
// 🚀 Routes de gestion des produits (CRUD)
// =================================================================

// 🔹 1. Récupérer tous les produits
router.get('/', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 🔹 2. Récupérer un produit par ID
router.get('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Invalid product ID' });

  try {
    const product = await prisma.product.findUnique({
      where: { id },
      include: { category: true },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (error) {
    console.error(`Error fetching product ${id}:`, error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// 🔹 3. Créer un produit
router.post('/', async (req, res) => {
  const validationErrors = validateProductData(req.body);
  if (validationErrors) return res.status(400).json({ errors: validationErrors });

  try {
    const categoryExists = await prisma.category.findUnique({
      where: { id: req.body.categoryId },
    });
    if (!categoryExists) {
      return res.status(400).json({ error: 'Specified category does not exist' });
    }

    let characteristicsData = req.body.characteristics;
    if (typeof characteristicsData === 'string') {
      try {
        characteristicsData = JSON.parse(characteristicsData);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON format for characteristics' });
      }
    }

    const newProduct = await prisma.product.create({
      data: {
        name: req.body.name,
        description: req.body.description || null,
        price: Number(req.body.price),
        photos: req.body.photos || [],
        characteristics: characteristicsData || {},
        stock_quantity: Number(req.body.stock_quantity) || 0,
        category: { connect: { id: req.body.categoryId } },
      },
      include: { category: true },
    });

    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// 🔹 4. Mettre à jour un produit
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Invalid product ID' });

  const validationErrors = validateProductData(req.body, true);
  if (validationErrors) return res.status(400).json({ errors: validationErrors });

  try {
    const productExists = await prisma.product.findUnique({ where: { id } });
    if (!productExists) return res.status(404).json({ error: 'Product not found' });

    if (req.body.categoryId) {
      const categoryExists = await prisma.category.findUnique({
        where: { id: req.body.categoryId },
      });
      if (!categoryExists) return res.status(400).json({ error: 'Specified category does not exist' });
    }

    const updateData = {};
    if (req.body.name !== undefined) updateData.name = req.body.name;
    if (req.body.description !== undefined) updateData.description = req.body.description || null;
    if (req.body.price !== undefined) updateData.price = Number(req.body.price);
    if (req.body.photos !== undefined) updateData.photos = req.body.photos || [];
    if (req.body.categoryId !== undefined) updateData.categoryId = req.body.categoryId;
    if (req.body.stock_quantity !== undefined) updateData.stock_quantity = Number(req.body.stock_quantity);

    if (req.body.characteristics !== undefined) {
      let characteristicsData = req.body.characteristics;
      if (typeof characteristicsData === 'string') {
        try {
          characteristicsData = JSON.parse(characteristicsData);
        } catch {
          return res.status(400).json({ error: 'Invalid JSON format for characteristics' });
        }
      }
      updateData.characteristics = characteristicsData;
    }

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: { category: true },
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error(`Error updating product ${id}:`, error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// 🔹 5. Supprimer un produit
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  if (!id) return res.status(400).json({ error: 'Invalid product ID' });

  try {
    const productExists = await prisma.product.findUnique({ where: { id } });
    if (!productExists) return res.status(404).json({ error: 'Product not found' });

    await prisma.product.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting product ${id}:`, error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// =================================================================
// 📦 Routes de gestion du stock
// =================================================================

// 🔹 6. Enregistrer un mouvement de stock
router.post('/:id/stock/movements', async (req, res) => {
  const { id } = req.params;
  const { type, quantity } = req.body;

  if (!['entry', 'exit'].includes(type) || quantity <= 0) {
    return res.status(400).json({ error: 'Type de mouvement ou quantité invalide.' });
  }

  try {
    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) return res.status(404).json({ error: 'Produit non trouvé.' });

    // Vérification du stock disponible avant sortie
    if (type === 'exit' && quantity > product.stock_quantity) {
      return res.status(400).json({ error: 'Stock insuffisant.' });
    }

    // Enregistrement du mouvement
    await prisma.stockMovement.create({
      data: {
        type,
        quantity,
        productId: id,
      },
    });

    // Mise à jour du stock
    const newQuantity =
      type === 'entry'
        ? product.stock_quantity + quantity
        : product.stock_quantity - quantity;

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: { stock_quantity: newQuantity },
      include: { category: true },
    });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement du mouvement:", error);
    res.status(500).json({ error: "Échec de l'enregistrement du mouvement." });
  }
});

export default router;
