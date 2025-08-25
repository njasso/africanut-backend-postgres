// backend/routes/auth.js
import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { requireAuth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = Router();

// Helper function to handle async routes
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Validate environment variables on startup
if (!process.env.JWT_SECRET) {
  console.error('❌ JWT_SECRET environment variable is not set!');
  process.exit(1);
}

router.post('/register', asyncHandler(async (req, res) => {
  console.log('📝 Registration attempt:', { 
    email: req.body?.email, 
    hasPassword: !!req.body?.password,
    name: req.body?.name,
    role: req.body?.role 
  });

  const { email, password, name, role } = req.body;

  // Validation
  if (!email || !password || !name) {
    console.log('❌ Registration validation failed: missing required fields');
    return res.status(400).json({ 
      error: 'Email, mot de passe et nom requis',
      details: {
        email: !email ? 'Email manquant' : null,
        password: !password ? 'Mot de passe manquant' : null,
        name: !name ? 'Nom manquant' : null,
      }
    });
  }

  try {
    // Check if user already exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      console.log('❌ Registration failed: email already exists:', email);
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }

    // Hash password
    const hash = await bcrypt.hash(password, 10);
    
    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.trim().toLowerCase(),
        password: hash,
        name: name.trim(),
        role: role || 'VIEWER',
      },
    });

    console.log('✅ User registered successfully:', { id: user.id, email: user.email });

    res.status(201).json({ 
      success: true,
      message: 'Utilisateur créé avec succès',
      user: {
        id: user.id, 
        email: user.email,
        name: user.name,
        role: user.role
      }
    });

  } catch (error) {
    console.error('❌ Registration error:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
    });
    
    // Handle Prisma specific errors
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Cet email est déjà utilisé' });
    }
    
    res.status(500).json({ 
      error: 'Erreur serveur lors de l\'inscription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

router.post('/login', asyncHandler(async (req, res) => {
  console.log('🔑 Login attempt:', { 
    email: req.body?.email,
    hasPassword: !!req.body?.password,
    bodyKeys: Object.keys(req.body || {}),
    contentType: req.get('Content-Type')
  });

  const { email, password } = req.body;

  // Validation
  if (!email || !password) {
    console.log('❌ Login validation failed:', { 
      hasEmail: !!email, 
      hasPassword: !!password 
    });
    return res.status(400).json({ 
      error: 'Email et mot de passe requis',
      details: {
        email: !email ? 'Email manquant' : null,
        password: !password ? 'Mot de passe manquant' : null,
      }
    });
  }

  try {
    // Find user
    const user = await prisma.user.findUnique({ 
      where: { email: email.trim().toLowerCase() } 
    });
    
    if (!user) {
      console.log('❌ Login failed: user not found:', email);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Check password
    const passwordValid = await bcrypt.compare(password, user.password);
    if (!passwordValid) {
      console.log('❌ Login failed: invalid password for:', email);
      return res.status(401).json({ error: 'Identifiants invalides' });
    }

    // Generate token
    const token = jwt.sign(
      { 
        id: user.id, 
        email: user.email, 
        role: user.role, 
        name: user.name 
      },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    console.log('✅ Login successful:', { id: user.id, email: user.email });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });

  } catch (error) {
    console.error('❌ Login error:', {
      message: error.message,
      stack: error.stack,
      email: req.body?.email,
    });
    
    res.status(500).json({ 
      error: 'Erreur serveur lors de la connexion',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  console.log('👤 Getting user info for:', req.user?.id);

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, name: true },
    });

    if (!user) {
      console.log('❌ User not found:', req.user?.id);
      return res.status(404).json({ error: 'Utilisateur non trouvé' });
    }

    console.log('✅ User info retrieved:', { id: user.id, email: user.email });
    res.json({ user });

  } catch (error) {
    console.error('❌ Get user error:', {
      message: error.message,
      userId: req.user?.id,
    });
    
    res.status(500).json({ 
      error: 'Erreur serveur lors de la récupération des informations',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}));

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    hasJwtSecret: !!process.env.JWT_SECRET,
  });
});

export default router;
