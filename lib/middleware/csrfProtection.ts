/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import crypto from 'node:crypto'
import * as utils from '../utils'

const csrfTokens: Record<string, { token: string, created: Date }> = {}

setInterval(() => {
  const now = new Date()
  for (const key in csrfTokens) {
    if (now.getTime() - csrfTokens[key].created.getTime() > 3600000) {
      delete csrfTokens[key]
    }
  }
}, 3600000) // Run cleanup every hour

/**
 * Generates a CSRF token for the current user session
 */
export const generateToken = (req: Request): string => {
  const userId = req.cookies?.token ? utils.jwtFrom(req) : 'unauthenticated'
  
  if (!csrfTokens[userId]) {
    const token = crypto.randomBytes(32).toString('hex')
    csrfTokens[userId] = { token, created: new Date() }
  }
  
  return csrfTokens[userId].token
}

/**
 * Middleware to add CSRF token to response locals for templates
 */
export const csrfTokenMiddleware = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.url.includes('/api') || !req.headers['user-agent']?.includes('Mozilla')) {
      next()
      return
    }
    
    res.locals.csrfToken = generateToken(req)
    next()
  }
}

/**
 * Middleware to validate CSRF token
 * Excludes the specific route/condition for the CSRF challenge
 */
export const csrfProtection = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (
      ['GET', 'HEAD', 'OPTIONS'].includes(req.method) || 
      req.url.includes('/api') || 
      !req.headers['user-agent']?.includes('Mozilla') ||
      req.headers.origin?.includes('://htmledit.squarefree.com') ||
      req.headers.referer?.includes('://htmledit.squarefree.com')
    ) {
      next()
      return
    }
    
    const token = req.body._csrf || req.headers['x-csrf-token'] || req.query._csrf
    const expectedToken = generateToken(req)
    
    if (!token || token !== expectedToken) {
      res.status(403).json({ error: 'CSRF token validation failed' })
      return
    }
    
    next()
  }
}
