import express from 'express';
import { PrismaClient } from '@prisma/client';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();

// ---------------------
// GET /api/articles
// ---------------------
router.get('/', async (req, res) => {
  try {
    const articles = await prisma.article.findMany({
      orderBy: { createdAt: 'desc' },
    });
    res.json(articles);
  } catch (error) {
    console.error("Erreur récupération articles:", error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des articles.',
      error: error.message,
    });
  }
});

// ---------------------
// GET /api/articles/:slug
// ---------------------
router.get('/:slug', async (req, res) => {
  const { slug } = req.params;
  try {
    const article = await prisma.article.findUnique({ where: { slug } });
    if (!article) return res.status(404).json({ message: "Article non trouvé." });
    res.json(article);
  } catch (error) {
    console.error("Erreur récupération article:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération de l'article.",
      error: error.message,
    });
  }
});

// ---------------------
// POST /api/articles
// ---------------------
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { title, content, excerpt, authorName, categories, tags, published, imageUrl } = req.body;

  if (!title || !content) {
    return res.status(400).json({ message: 'Le titre et le contenu sont requis.' });
  }

  try {
    const slug = title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "");

    const newArticle = await prisma.article.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        authorName: authorName || "Admin",
        categories: categories || ["General"],
        tags: tags || [],
        published: published ?? false,
        publishedAt: published ? new Date() : null,
        imageUrl: imageUrl || null,
      },
    });

    res.status(201).json(newArticle);
  } catch (error) {
    console.error("Erreur création article:", error);
    res.status(500).json({ message: "Erreur lors de la création de l'article.", error: error.message });
  }
});

// ---------------------
// PUT /api/articles/:id
// ---------------------
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  const { title, content, excerpt, authorName, categories, tags, published, imageUrl } = req.body;

  try {
    // Regénérer le slug si le titre change
    const slug = title ? title.toLowerCase().replace(/\s+/g, "-").replace(/[^\w-]+/g, "") : undefined;

    const updatedArticle = await prisma.article.update({
      where: { id: parseInt(id) },
      data: {
        title,
        slug,
        content,
        excerpt,
        authorName,
        categories,
        tags,
        published,
        publishedAt: published ? new Date() : null,
        imageUrl,
      },
    });

    res.json(updatedArticle);
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Article non trouvé.' });
    console.error("Erreur mise à jour article:", error);
    res.status(500).json({ message: "Erreur lors de la mise à jour de l'article.", error: error.message });
  }
});

// ---------------------
// DELETE /api/articles/:id
// ---------------------
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.article.delete({ where: { id: parseInt(id) } });
    res.json({ message: 'Article supprimé avec succès.' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ message: 'Article non trouvé.' });
    console.error("Erreur suppression article:", error);
    res.status(500).json({ message: "Erreur lors de la suppression de l'article.", error: error.message });
  }
});

export default router;
