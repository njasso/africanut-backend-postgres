import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import pkg from '@prisma/client';
import fetch from 'node-fetch';

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

import { requireAuth, requireRole } from './middleware/auth.js';

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
const app = express();

// ----------------------------------------------------------------
// CORS CONFIG
// ----------------------------------------------------------------
const allowedOrigins = [
  'https://africanutindustryplatform.netlify.app', // frontend Netlify
  'http://localhost:3000' // pour tests locaux
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow non-browser requests
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = `Le CORS pour cet origin (${origin}) n'est pas autorisé.`;
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Gérer explicitement les OPTIONS pour le preflight
app.options('*', cors());

// ----------------------------------------------------------------
// MIDDLEWARES GÉNÉRAUX
// ----------------------------------------------------------------
app.use(helmet());
app.use(express.json());
app.use(morgan('dev'));

// ----------------------------------------------------------------
// ENDPOINT PROXY DE DEEPSEEK
// ----------------------------------------------------------------
app.post('/api/deepseek-analyze', async (req, res) => {
  try {
    const deepseekApiKey = process.env.DEEPSEEK_API_KEY;
    if (!deepseekApiKey) return res.status(500).json({ error: 'Clé API DeepSeek manquante' });

    const { accountingData, monthlyData, totalPnl, balanceSheet } = req.body;

    const analysisPrompt = `Effectuez une analyse financière de cette entreprise basée sur les données suivantes :
    - Données comptables brutes : ${JSON.stringify(accountingData)}
    - Données mensuelles (évolution) : ${JSON.stringify(monthlyData)}
    - Compte de résultat (P&L) : ${JSON.stringify(totalPnl)}
    - Bilan : ${JSON.stringify(balanceSheet)}

    Fournissez une analyse complète incluant la détection d'anomalies, une analyse de la profitabilité et des recommandations concrètes. Le format de sortie doit être un objet JSON avec anomalies, profitabilityAnalysis et recommendations.`;

    const deepSeekBody = {
      model: "deepseek-chat",
      messages: [{ role: "user", content: analysisPrompt }],
      stream: false
    };

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${deepseekApiKey}` },
      body: JSON.stringify(deepSeekBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API DeepSeek: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erreur DeepSeek:', error);
    res.status(500).json({ error: 'Échec de la communication avec DeepSeek', details: error.message });
  }
});

// ----------------------------------------------------------------
// ROUTES PUBLIQUES
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
// ROUTES PROTÉGÉES PAR AUTHENTIFICATION
// ----------------------------------------------------------------
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/metrics', requireAuth, metricRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// ----------------------------------------------------------------
// DÉMARRAGE DU SERVEUR
// ----------------------------------------------------------------
const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    // Seed companies si nécessaire
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
      console.log('Seeded base companies');
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
};

startServer();
