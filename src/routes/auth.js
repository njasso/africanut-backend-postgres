import { Router } from 'express'
import pkg from '@prisma/client' // Import the entire module as 'pkg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'

const { PrismaClient, Role } = pkg // Destructure the required exports from 'pkg'

const prisma = new PrismaClient()
const router = Router()

router.post('/register', async (req,res)=>{
  const { email, password, name, role } = req.body
  const hash = await bcrypt.hash(password, 10)
  const user = await prisma.user.create({ data: { email, password: hash, name, role: role || 'VIEWER' } })
  res.json({ id: user.id, email: user.email })
})

router.post('/login', async (req,res)=>{
  const { email, password } = req.body
  const user = await prisma.user.findUnique({ where: { email } })
  if(!user) return res.status(401).json({ error: 'Invalid credentials' })
  const ok = await bcrypt.compare(password, user.password)
  if(!ok) return res.status(401).json({ error: 'Invalid credentials' })
  const token = jwt.sign({ id:user.id, email:user.email, role:user.role, name:user.name }, process.env.JWT_SECRET, { expiresIn:'8h' })
  res.json({ token, user: { id:user.id, email:user.email, role:user.role, name:user.name } })
})

export default router
