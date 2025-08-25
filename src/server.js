import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pkg from '@prisma/client';
import fetch from 'node-fetch';

// Routes
import authRoutes from './routes/auth.js';
import companyRoutes from './routes/companies.js';
import employeeRoutes from './routes/employees.js';
import accountingRoutes from './routes/accounting.js';
import projectRoutes from './routes/projects.js';
import metricRoutes from './routes/metrics.js';
import reportRoutes from './routes/reports.js';
import storeRoutes from './routes/store.js';
import productsRoutes from './routes/products.js';
import categoriesRoutes from './routes/categories.js';
import uploadRoutes from './routes/upload.js';
import webinarRoutes from './routes/webinars.js';
import articlesRouter from './routes/articles.js';
import livresBlancsRouter from './routes/livres-blancs.js';
import brochuresRouter from './routes/brochures.js';
import communiquesRouter from './routes/communiques.js';
import mediathequeRouter from './routes/mediatheque.js';
import appsRouter from './routes/apps.js';
import infoKitsRouter from './routes/info-kits.js';
import ordersRouter from './routes/orders.js'; 
import { requireAuth } from './middleware/auth.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();

// -----------------------------
// ✅ Configuration CORS
// -----------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "https://africanutindustryplatform.netlify.app"
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn("❌ Origin bloquée par CORS:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
}));

// -----------------------------
// Middlewares globaux
// -----------------------------
app.use(
  helmet({
    crossOriginResourcePolicy: false, // nécessaire pour autoriser Netlify
  })
);
app.use(express.json());
app.use(morgan('dev'));

// -----------------------------
// ✅ Route IA DeepSeek
// -----------------------------
app.post('/api/deepseek-analyze', async (req, res) => {
  try {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) {
      return res.status(500).json({ error: 'Clé API DeepSeek manquante' });
    }

    const { accountingData, monthlyData, totalPnl, balanceSheet } = req.body;

    const analysisPrompt = `Effectuez une analyse financière basée sur :
    - Données comptables : ${JSON.stringify(accountingData)}
    - Données mensuelles : ${JSON.stringify(monthlyData)}
    - Compte de résultat : ${JSON.stringify(totalPnl)}
    - Bilan : ${JSON.stringify(balanceSheet)}

    Format de sortie JSON :
    {
      "anomalies": [{ "type": "string", "message": "string", "severity": "string", "suggestions": ["string"] }],
      "profitabilityAnalysis": { "trend": "number", "status": "string", "message": "string" },
      "recommendations": [{ "type": "string", "message": "string", "suggestion": "string" }]
    }`;

    const deepSeekBody = {
      model: "deepseek-chat",
      messages: [{ role: "user", content: analysisPrompt }],
      stream: false
    };

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${deepseekApiKey}`
      },
      body: JSON.stringify(deepSeekBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API DeepSeek: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);

  } catch (error) {
    console.error("Erreur DeepSeek:", error);
    res.status(500).json({ error: "Échec communication API DeepSeek", details: error.message });
  }
});

// -----------------------------
// ✅ Routes principales
// -----------------------------
app.use('/api/auth', authRoutes);
app.use('/api/companies', companyRoutes);
app.use('/api/store', storeRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/webinars', webinarRoutes);
app.use('/api/articles', articlesRouter);
app.use('/api/livres-blancs', livresBlancsRouter);
app.use('/api/brochures', brochuresRouter);
app.use('/api/communiques', communiquesRouter);
app.use('/api/mediatheque', mediathequeRouter);
app.use('/api/apps', appsRouter);
app.use('/api/info-kits', infoKitsRouter);
app.use('/api/orders', ordersRouter);

// ✅ Routes protégées
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/metrics', requireAuth, metricRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// -----------------------------
// ✅ Middleware gestion erreurs CORS
// -----------------------------
app.use((err, req, res, next) => {
  if (err.message.includes("CORS")) {
    return res.status(403).json({ error: "Requête bloquée par CORS", details: err.message });
  }
  next(err);
});

// -----------------------------
// ✅ Lancement serveur
// -----------------------------
const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    const count = await prisma.company.count();
    if (count === 0) {
      await prisma.company.createMany({
        data: [
          { slug: 'africanut-fish-market', name: 'AFRICANUT FISH MARKET', sector: 'Aquaculture', tagline: 'Production piscicole & services' },
          { slug: 'magaton-provender', name: 'MAGATON PROVENDER', sector: 'Agro-industrie', tagline: 'Aliments & intrants' },
          { slug: 'nouvelle-academie-numerique-africaine', name: 'NOUVELLE ACADEMIE NUMERIQUE AFRICAINE', sector: 'Education & Numérique', tagline: 'Formation & digital' },
          { slug: 'africanut-media', name: 'AFRICANUT MEDIA', sector: 'Média & Communication', tagline: 'Contenus du groupe' },
        ],
      });
      console.log("Seeded base companies ✅");
    }

    // ✅ Pas besoin de forcer "0.0.0.0"
    app.listen(PORT, () => {
      console.log(`🚀 API running on port ${PORT}`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
