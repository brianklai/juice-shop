/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'

export function serveQuarantineFiles () {
  return ({ params, query }: Request, res: Response, next: NextFunction) => {
    const file = params.file
    
    const safeFile = file.replace(/[^a-zA-Z0-9._-]/g, '')
    const filePath = path.resolve('ftp/quarantine', safeFile)
    const baseDir = path.resolve('ftp/quarantine')
    
    if (filePath.startsWith(baseDir)) {
      res.sendFile(filePath)
    } else {
      res.status(403)
      next(new Error('File access denied due to path traversal attempt!'))
    }
  }
}
