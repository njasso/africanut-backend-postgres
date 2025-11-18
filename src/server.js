import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pkg from '@prisma/client';
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
import fetch from 'node-fetch';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();

// ----------------------
// ✅ Configuration CORS
// ----------------------
const allowedOrigins = [
  "https://africanutindustryplatform.netlify.app", // ton frontend en prod
  "http://localhost:5173", // pour tes tests locaux
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

app.use(cors(corsOptions));

// ----------------------
// Middlewares généraux
// ----------------------
app.use(helmet());
app.use(express.json({ limit: '5mb' })); // sécurité sur taille payload
app.use(morgan('dev'));

// ----------------------------------------------------------------
// Routes publiques
// ----------------------------------------------------------------
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

// ----------------------------------------------------------------
// Routes protégées
// ----------------------------------------------------------------
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/metrics', requireAuth, metricRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// ----------------------------------------------------------------
// Exemple d’endpoint IA
// ----------------------------------------------------------------
app.post('/api/deepseek-analyze', async (req, res) => {
  try {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) return res.status(500).json({ error: 'Clé API DeepSeek manquante' });

    const { accountingData, monthlyData, totalPnl, balanceSheet } = req.body;
    const analysisPrompt = `Effectuez une analyse financière avec ces données : ${JSON.stringify({
      accountingData,
      monthlyData,
      totalPnl,
      balanceSheet,
    })}. Retournez un JSON structuré.`;

    const deepSeekBody = {
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: analysisPrompt }],
      stream: false,
    };

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify(deepSeekBody),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`DeepSeek API error ${response.status}: ${text}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur DeepSeek', details: err.message });
  }
});

// ----------------------------------------------------------------
// Démarrage serveur
// ----------------------------------------------------------------
const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    // ✅ Seed companies si vide
    const count = await prisma.company.count();
    if (count === 0) {
      await prisma.company.createMany({
        data: [
          {
            slug: 'africanut-fish-market',
            name: 'AFRICANUT FISH MARKET',
            sector: 'Aquaculture',
            tagline: 'Production piscicole & services',
          },
          {
            slug: 'magaton-provender',
            name: 'MAGATON PROVENDER',
            sector: 'Agro-industrie',
            tagline: 'Aliments & intrants',
          },
          {
            slug: 'nouvelle-academie-numerique-africaine',
            name: 'NOUVELLE ACADEMIE NUMERIQUE AFRICAINE',
            sector: 'Education & Numérique',
            tagline: 'Formation & digital',
          },
          {
            slug: 'africanut-media',
            name: 'AFRICANUT MEDIA',
            sector: 'Média & Communication',
            tagline: 'Contenus du groupe',
          },
        ],
      });
      console.log('Seeded companies');
    }

    app.listen(PORT, () =>
      console.log(`✅ Server running on port ${PORT} (Railway ready)`)
    );

  } catch (error) {
    console.error('Failed to start the server:', error);
    process.exit(1);
  }
};

startServer();
