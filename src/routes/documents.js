import { Router } from "express";
import multer from "multer";
import pkg from "@prisma/client";
import { requireAuth } from "../middleware/auth.js";
import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const router = Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

// ------------------
// GET /api/documents
// ------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const { companySlug } = req.query;
    let where = {};

    if (companySlug) {
      const company = await prisma.company.findUnique({ where: { slug: companySlug } });
      if (!company) return res.status(400).json({ error: "Entreprise invalide" });
      where.companyId = company.id;
    }

    const docs = await prisma.document.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        company: { select: { id: true, name: true, slug: true } },
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    res.json(docs);
  } catch (err) {
    console.error("Erreur GET /api/documents", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ------------------
// POST /api/documents (création + upload fichier)
// ------------------
router.post("/", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { label, companySlug, documentType, documentNumber, documentDate } = req.body;

    if (!req.file) return res.status(400).json({ error: "Aucun fichier fourni" });
    if (!companySlug) return res.status(400).json({ error: "Entreprise invalide" });

    const company = await prisma.company.findUnique({ where: { slug: companySlug } });
    if (!company) return res.status(400).json({ error: "Entreprise invalide" });

    const b64 = Buffer.from(req.file.buffer).toString("base64");
    const dataURI = `data:${req.file.mimetype};base64,${b64}`;
    const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
      folder: `africanut/${company.slug}`,
    });

    const doc = await prisma.document.create({
      data: {
        label,
        path: cloudinaryResponse.secure_url,
        mimeType: req.file.mimetype,
        size: req.file.size,
        companyId: company.id,
        uploadedById: req.user.id,
        documentType,
        documentNumber,
        documentDate: documentDate ? new Date(documentDate) : null,
      },
      include: { company: true, uploadedBy: true },
    });

    res.status(201).json(doc);
  } catch (err) {
    console.error("Erreur POST /api/documents", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ------------------
// PUT /api/documents/:id (update fichier et/ou métadonnées)
// ------------------
router.put("/:id", requireAuth, upload.single("file"), async (req, res) => {
  try {
    const { id } = req.params;
    const { label, companySlug, documentType, documentNumber, documentDate } = req.body;

    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: "Document non trouvé" });

    let companyId = doc.companyId;
    if (companySlug) {
      const company = await prisma.company.findUnique({ where: { slug: companySlug } });
      if (!company) return res.status(400).json({ error: "Entreprise invalide" });
      companyId = company.id;
    }

    let updateData = {
      label: label !== undefined ? label : doc.label,
      documentType: documentType !== undefined ? documentType : doc.documentType,
      documentNumber: documentNumber !== undefined ? documentNumber : doc.documentNumber,
      documentDate: documentDate ? new Date(documentDate) : doc.documentDate,
      companyId,
    };

    // Si un nouveau fichier est uploadé, on remplace l'ancien
    if (req.file) {
      // Supprimer l'ancien fichier Cloudinary
      const parts = doc.path.split("/");
      const filename = parts.pop().split(".")[0];
      const folder = parts.slice(parts.indexOf("upload") + 1).join("/");
      const publicId = `${folder}/${filename}`;
      try {
        await cloudinary.uploader.destroy(publicId);
      } catch (err) {
        console.warn("⚠️ Impossible de supprimer ancien fichier :", err.message);
      }

      // Upload nouveau fichier
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = `data:${req.file.mimetype};base64,${b64}`;
      const cloudinaryResponse = await cloudinary.uploader.upload(dataURI, {
        folder: `africanut/${companySlug || doc.company.slug}`,
      });

      updateData.path = cloudinaryResponse.secure_url;
      updateData.mimeType = req.file.mimetype;
      updateData.size = req.file.size;
    }

    const updatedDoc = await prisma.document.update({
      where: { id },
      data: updateData,
      include: { company: true, uploadedBy: true },
    });

    res.json(updatedDoc);
  } catch (err) {
    console.error("Erreur PUT /api/documents/:id", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ------------------
// DELETE /api/documents/:id
// ------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const doc = await prisma.document.findUnique({ where: { id } });
    if (!doc) return res.status(404).json({ error: "Document non trouvé" });

    const parts = doc.path.split("/");
    const filename = parts.pop().split(".")[0];
    const folder = parts.slice(parts.indexOf("upload") + 1).join("/");
    const publicId = `${folder}/${filename}`;

    try {
      await cloudinary.uploader.destroy(publicId);
    } catch (err) {
      console.warn("⚠️ Impossible de supprimer sur Cloudinary :", err.message);
    }

    await prisma.document.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Erreur DELETE /api/documents/:id", err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
