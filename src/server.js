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

// Debug middleware - TEMPORARY for debugging the JSON issue
const debugMiddleware = (req, res, next) => {
  if (req.url.includes('/api/auth/login')) {
    console.log('\n🔍 === AUTH LOGIN DEBUG ===');
    console.log('Method:', req.method);
    console.log('URL:', req.url);
    console.log('Content-Type:', req.get('Content-Type'));
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    // Capture raw body
    let rawBody = '';
    req.on('data', chunk => {
      rawBody += chunk.toString();
      console.log('Raw body chunk:', chunk.toString());
    });
    
    req.on('end', () => {
      console.log('Complete raw body:', rawBody);
      console.log('Raw body length:', rawBody.length);
      console.log('Raw body bytes:', Buffer.from(rawBody).toJSON());
      try {
        const parsed = JSON.parse(rawBody);
        console.log('Successfully parsed JSON:', parsed);
      } catch (parseError) {
        console.error('JSON parse error in middleware:', parseError.message);
        console.error('Problematic character at position:', parseError.message.match(/position (\d+)/)?.[1]);
      }
    });
    
    console.log('=========================\n');
  }
  next();
};

// Add debug middleware BEFORE body parsing
app.use(debugMiddleware);

// Configuration CORS - Enhanced
app.use(cors({
  origin: [
    'http://localhost:5173', 
    'https://africanutindustryplatform.netlify.app',
    'http://localhost:3000' // Add this for testing
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Origin',
    'X-Requested-With'
  ],
  preflightContinue: false,
  optionsSuccessStatus: 200
}));

// Middlewares globaux
app.use(helmet({ 
  crossOriginResourcePolicy: false,
  contentSecurityPolicy: false // Disable for development
}));

// Enhanced body parsing with error handling
app.use(express.json({ 
  limit: '10mb',
  strict: true,
  type: 'application/json'
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: '10mb' 
}));

// Add raw body parser for debugging
app.use('/api/auth', express.raw({ 
  type: 'application/json',
  limit: '10mb'
}), (req, res, next) => {
  if (req.body && req.body.length > 0) {
    try {
      const bodyString = req.body.toString('utf8');
      console.log('🔧 Raw body string:', bodyString);
      req.body = JSON.parse(bodyString);
      console.log('🔧 Parsed body:', req.body);
    } catch (error) {
      console.error('🔧 Manual JSON parsing failed:', error.message);
      return res.status(400).json({ 
        error: 'Invalid JSON format',
        details: error.message,
        receivedData: req.body.toString('utf8')
      });
    }
  }
  next();
});

// Morgan with custom format for better debugging
app.use(morgan('combined'));

// Health check endpoint
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

// Test endpoint for JSON parsing
app.post('/api/test-json', (req, res) => {
  console.log('🧪 Test JSON endpoint hit');
  console.log('Body:', req.body);
  console.log('Body type:', typeof req.body);
  res.json({ 
    received: req.body,
    type: typeof req.body,
    success: true 
  });
});

// Route IA DeepSeek
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

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${deepseekApiKey}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: analysisPrompt }],
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Erreur API DeepSeek: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Erreur DeepSeek:', error);
    res.status(500).json({ error: 'Échec communication API DeepSeek', details: error.message });
  }
});

// Routes principales
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

// Routes protégées
app.use('/api/employees', requireAuth, employeeRoutes);
app.use('/api/accounting', requireAuth, accountingRoutes);
app.use('/api/projects', requireAuth, projectRoutes);
app.use('/api/metrics', requireAuth, metricRoutes);
app.use('/api/reports', requireAuth, reportRoutes);

// Enhanced error handling middleware
app.use((err, req, res, next) => {
  console.error('\n❌ === ERROR HANDLER ===');
  console.error('Error type:', err.constructor.name);
  console.error('Error message:', err.message);
  console.error('Error stack:', err.stack);
  console.error('Request URL:', req.url);
  console.error('Request method:', req.method);
  console.error('Request headers:', req.headers);
  console.error('Request body:', req.body);
  console.error('=====================\n');

  // Handle specific error types
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Invalid JSON format',
      details: 'The request body contains malformed JSON',
      message: err.message
    });
  }

  res.status(err.status || 500).json({
    error: 'Erreur serveur',
    details: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error',
    type: err.constructor.name
  });
});

// 404 handler
app.use('*', (req, res) => {
  console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    error: 'Route not found',
    method: req.method,
    url: req.originalUrl,
    availableRoutes: [
      'GET /api/health',
      'POST /api/test-json',
      'POST /api/auth/login',
      'POST /api/auth/register',
      'GET /api/auth/me'
    ]
  });
});

// Lancement serveur
const PORT = process.env.PORT || 5005;

const startServer = async () => {
  try {
    // Check environment variables
    console.log('🔍 Environment check:');
    console.log('- NODE_ENV:', process.env.NODE_ENV);
    console.log('- PORT:', PORT);
    console.log('- JWT_SECRET:', process.env.JWT_SECRET ? '✅ Set' : '❌ Missing');
    console.log('- DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Missing');

    // Vérifier la connexion à la base de données
    await prisma.$connect();
    console.log('✅ Connexion à la base de données établie');

    // Test database with a simple query
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);

    // Initialiser les données de base
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
      console.log('✅ Données initiales des entreprises insérées');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🧪 Test JSON: http://localhost:${PORT}/api/test-json`);
      console.log(`🔑 Login endpoint: http://localhost:${PORT}/api/auth/login`);
    });
  } catch (err) {
    console.error('❌ Échec du démarrage du serveur:', err);
    process.exit(1);
  }
};

startServer();
