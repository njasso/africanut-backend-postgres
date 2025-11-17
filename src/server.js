import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { Client, Account, Databases, Storage, Query } from 'appwrite';
import { PrismaClient } from '@prisma/client';
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

// ----------------------
// ✅ Configuration Appwrite
// ----------------------
const appwriteClient = new Client()
  .setEndpoint('https://fra.cloud.appwrite.io/v1')
  .setProject('6917d60c001a8ea43024');

// Services Appwrite
export const databases = new Databases(appwriteClient);
export const storage = new Storage(appwriteClient);
export const account = new Account(appwriteClient);

// Configuration des bases de données Appwrite
export const APPWRITE_DATABASES = {
  MAIN: '6917e2c70008c7f35ac9', // ID de votre database
  COLLECTIONS: {
    USERS: 'users',
    COMPANIES: 'companies',
    EMPLOYEES: 'employees',
    PRODUCTS: 'products',
    ORDERS: 'orders'
  }
};

// ----------------------
// ✅ Configuration Prisma (PostgreSQL Neon)
// ----------------------
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  },
  log: ['query', 'error', 'warn']
});

const app = express();

// ----------------------
// ✅ Configuration CORS
// ----------------------
const allowedOrigins = [
  "https://africanutindustryplatform.netlify.app",
  "http://localhost:5173",
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Appwrite-Project', 'X-Appwrite-Key'],
  credentials: true,
};

app.use(cors(corsOptions));

// ----------------------
// Middlewares généraux
// ----------------------
app.use(helmet());
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

// ----------------------
// Middleware Appwrite (optionnel pour l'authentification)
// ----------------------
app.use(async (req, res, next) => {
  // Vous pouvez utiliser Appwrite pour l'auth ou garder votre système actuel
  req.appwrite = {
    databases,
    storage,
    account,
    config: APPWRITE_DATABASES
  };
  next();
});

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
// Routes Appwrite spécifiques
// ----------------------------------------------------------------

// Test de connexion Appwrite
app.get('/api/appwrite/health', async (req, res) => {
  try {
    // Test de connexion à la database Appwrite
    const response = await databases.listDocuments(
      APPWRITE_DATABASES.MAIN,
      APPWRITE_DATABASES.COLLECTIONS.COMPANIES,
      [Query.limit(1)]
    );
    
    res.json({ 
      status: 'OK', 
      appwrite: 'Connected',
      database: 'Accessible',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'Error', 
      appwrite: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Synchronisation des données entre Prisma et Appwrite (optionnel)
app.post('/api/sync/companies', async (req, res) => {
  try {
    const companies = await prisma.company.findMany();
    
    const syncResults = [];
    
    for (const company of companies) {
      try {
        // Vérifier si la company existe déjà dans Appwrite
        const existingCompanies = await databases.listDocuments(
          APPWRITE_DATABASES.MAIN,
          APPWRITE_DATABASES.COLLECTIONS.COMPANIES,
          [Query.equal('slug', company.slug)]
        );
        
        if (existingCompanies.documents.length === 0) {
          // Créer dans Appwrite
          const appwriteCompany = await databases.createDocument(
            APPWRITE_DATABASES.MAIN,
            APPWRITE_DATABASES.COLLECTIONS.COMPANIES,
            'unique()', // Appwrite génère l'ID
            {
              slug: company.slug,
              name: company.name,
              sector: company.sector,
              tagline: company.tagline,
              prismaId: company.id,
              createdAt: company.createdAt.toISOString(),
              updatedAt: company.updatedAt.toISOString()
            }
          );
          syncResults.push({ company: company.name, status: 'created', id: appwriteCompany.$id });
        } else {
          syncResults.push({ company: company.name, status: 'exists', id: existingCompanies.documents[0].$id });
        }
      } catch (error) {
        syncResults.push({ company: company.name, status: 'error', error: error.message });
      }
    }
    
    res.json({ syncResults });
  } catch (error) {
    res.status(500).json({ error: 'Sync failed', details: error.message });
  }
});

// ----------------------------------------------------------------
// Endpoint DeepSeek (conservé tel quel)
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
// Health Check complet
// ----------------------------------------------------------------
app.get('/api/health', async (req, res) => {
  try {
    // Test Prisma (Neon PostgreSQL)
    await prisma.$queryRaw`SELECT 1`;
    const prismaStatus = 'OK';
    
    // Test Appwrite
    let appwriteStatus = 'OK';
    try {
      await databases.listDocuments(
        APPWRITE_DATABASES.MAIN,
        APPWRITE_DATABASES.COLLECTIONS.COMPANIES,
        [Query.limit(1)]
      );
    } catch (error) {
      appwriteStatus = `Error: ${error.message}`;
    }
    
    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      databases: {
        prisma: prismaStatus,
        appwrite: appwriteStatus
      },
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({
      status: 'Error',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// ----------------------------------------------------------------
// Démarrage serveur
// ----------------------------------------------------------------
const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    // ✅ Test des connexions aux bases de données
    console.log('🔌 Testing database connections...');
    
    // Test Prisma (Neon)
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ PostgreSQL Neon connected via Prisma');
    
    // Test Appwrite
    try {
      await databases.listDocuments(
        APPWRITE_DATABASES.MAIN,
        APPWRITE_DATABASES.COLLECTIONS.COMPANIES,
        [Query.limit(1)]
      );
      console.log('✅ Appwrite connected');
    } catch (error) {
      console.warn('⚠️ Appwrite connection issue (check configuration):', error.message);
    }
    
    // ✅ Seed companies si vide (Prisma)
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
      console.log('✅ Seeded companies in PostgreSQL');
    }

    app.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`📊 PostgreSQL Neon: Connected`);
      console.log(`☁️ Appwrite: Configured`);
      console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

  } catch (error) {
    console.error('❌ Failed to start the server:', error);
    process.exit(1);
  }
};

// Gestion propre de la fermeture
process.on('SIGINT', async () => {
  console.log('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('🛑 Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

startServer();

// Export pour les tests
export { app, prisma };
