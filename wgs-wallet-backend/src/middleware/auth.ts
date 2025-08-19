import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

const JWT_SECRET = process.env.JWT_SECRET || 'wgs-wallet-secret-key'

export interface AuthRequest extends Request {
  userId?: string
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' })
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string }
  } catch {
    return null
  }
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' })
  }

  const token = authHeader.substring(7)
  const payload = verifyToken(token)
  
  if (!payload) {
    return res.status(401).json({ error: 'Invalid or expired token' })
  }

  req.userId = payload.userId
  next()
}

// Simple login endpoint for demo purposes
export function createDemoUser(): { userId: string; token: string } {
  const userId = `user_${Date.now()}`
  const token = signToken(userId)
  return { userId, token }
}


