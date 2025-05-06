/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path from 'node:path'
import { type Request, type Response } from 'express'
import { challenges } from '../data/datacache'
import * as challengeUtils from '../lib/challengeUtils'

export function servePremiumContent () {
  return (req: Request, res: Response) => {
    try {
      challengeUtils.solveIf(challenges.premiumPaywallChallenge, () => { return true })
      
      const baseDir = path.resolve('frontend/dist/frontend/assets/private')
      const filePath = path.resolve(baseDir, 'JuiceShop_Wallpaper_1920x1080_VR.jpg')
      
      if (!filePath.startsWith(baseDir)) {
        console.error('Security check failed: Path would be outside target directory')
        return res.status(403).send('Forbidden')
      }
      
      res.sendFile(filePath)
    } catch (error) {
      console.error('Error serving premium content:', error)
      res.status(500).send('Error serving premium content')
    }
  }
}
