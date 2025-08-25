// backend/index.js
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { PrismaClient } from '@prisma/client';
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

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5005;

// -----------------------------
// Debug Middleware (login JSON)
// -----------------------------
app.use((req, res, next) => {
  if (req.url.includes('/api/auth/login')) {
    console.log(`\n🔍 [DEBUG LOGIN] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));

    let rawBody = '';
    req.on('data', (chunk) => (rawBody += chunk.toString()));
    req.on('end', () => {
      console.log('Raw body:', rawBody);
      try {
        console.log('Parsed JSON:', JSON.parse(rawBody));
      } catch (err) {
        console.error('JSON parse error:', err.message);
      }
    });
  }
  next();
});

// -----------------------------
// Middleware & Security
// -----------------------------
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:3000',
    'https://africanutindustryplatform.netlify.app',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
}));

app.use(helmet({ crossOriginResourcePolicy: false, contentSecurityPolicy: false }));
app.use(express.json({ limit: '10mb', strict: true }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(morgan('combined'));

// -----------------------------
// Raw body parser for auth debugging
// -----------------------------
app.use('/api/auth', express.raw({ type: 'application/json', limit: '10mb' }), (req, res, next) => {
  if (req.body && req.body.length > 0) {
    try {
      req.body = JSON.parse(req.body.toString('utf8'));
    } catch (err) {
      return res.status(400).json({
        error: 'Invalid JSON format',
        details: err.message,
        receivedData: req.body.toString('utf8'),
      });
    }
  }
  next();
});

// -----------------------------
// Health & Test Endpoints
// -----------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    port: PORT,
    hasJwtSecret: !!process.env.JWT_SECRET,
    hasDatabaseUrl: !!process.env.DATABASE_URL,
  });
});

app.post('/api/test-json', (req, res) => {
  console.log('🧪 Test JSON body:', req.body);
  res.json({ received: req.body, type: typeof req.body, success: true });
});

// -----------------------------
// DeepSeek Analyze Route
// -----------------------------
app.post('/api/deepseek-analyze', async (req, res) => {
  try {
    const key = process.env.DEEPSEEK_API_KEY;
    if (!key) return res.status(500).json({ error: 'Clé API DeepSeek manquante' });

    const { accountingData, monthlyData, totalPnl, balanceSheet } = req.body;
    const prompt = `Effectuez une analyse financière basée sur :
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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'user', content: prompt }], stream: false }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur DeepSeek: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (err) {
    console.error('Erreur DeepSeek:', err);
    res.status(500).json({ error: 'Échec communication API DeepSeek', details: err.message });
  }
});

// -----------------------------
// Main Routes
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

// Protected Routes
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/metrics', requireAuth, metricRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// -----------------------------
// Error Handling
// -----------------------------
app.use((err, req, res, next) => {
  console.error('\n❌ ERROR HANDLER', err);
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Invalid JSON format', message: err.message });
  }
  res.status(err.status || 500).json({
    error: 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    type: err.constructor.name,
  });
});

// 404 Handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      'GET /api/health',
      'POST /api/test-json',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/auth/me',
    ],
  });
});

// -----------------------------
// Start Server & DB Init
// -----------------------------
const startServer = async () => {
  try {
    console.log('🔍 Environment:', { NODE_ENV: process.env.NODE_ENV, PORT, JWT_SECRET: !!process.env.JWT_SECRET, DATABASE_URL: !!process.env.DATABASE_URL });
    await prisma.$connect();
    console.log('✅ Database connected');

    const userCount = await prisma.user.count();
    console.log(`📊 Users in DB: ${userCount}`);

    const companyCount = await prisma.company.count();
    if (companyCount === 0) {
      await prisma.company.createMany({
        data: [
          { slug: 'africanut-fish-market', name: 'AFRICANUT FISH MARKET', sector: 'Aquaculture', tagline: 'Production piscicole & services' },
          { slug: 'magaton-provender', name: 'MAGATON PROVENDER', sector: 'Agro-industrie', tagline: 'Aliments & intrants' },
          { slug: 'nouvelle-academie-numerique-africaine', name: 'NOUVELLE ACADEMIE NUMERIQUE AFRICAINE', sector: 'Education & Numérique', tagline: 'Formation & digital' },
          { slug: 'africanut-media', name: 'AFRICANUT MEDIA', sector: 'Média & Communication', tagline: 'Contenus du groupe' },
        ],
      });
      console.log('✅ Initial companies inserted');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running at http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test JSON: http://localhost:${PORT}/api/test-json`);
      console.log(`🔑 Login: http://localhost:${PORT}/api/auth/login`);
    });
  } catch (err) {
    console.error('❌ Server startup failed:', err);
    process.exit(1);
  }
};

startServer();
