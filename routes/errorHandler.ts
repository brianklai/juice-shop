/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import fs from 'node:fs/promises'
import config from 'config'
import pug from 'pug'

import * as utils from '../lib/utils'

export function errorHandler () {
  return async (error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error)
      return
    }

    if (req?.headers?.accept === 'application/json') {
      try {
        const serializedError = JSON.stringify(error)
        const parsedError = serializedError ? JSON.parse(serializedError) : { message: 'Unknown error' }
        res.status(500).json({ error: parsedError })
      } catch (err) {
        res.status(500).json({ error: { message: error instanceof Error ? error.message : 'Unknown error' } })
      }
      return
    }

    const template = await fs.readFile('views/errorPage.pug', { encoding: 'utf-8' })
    const title = `${config.get<string>('application.name')} (Express ${utils.version('express')})`
    const fn = pug.compile(template)
    res.status(500).send(fn({ title, error }))
  }
}
