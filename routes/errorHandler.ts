/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import fs from 'node:fs/promises'
import path from 'node:path'
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

    try {
      const templatePath = path.resolve('views/errorPage.pug')
      const template = await fs.readFile(templatePath, { encoding: 'utf-8' })
      const title = `${config.get<string>('application.name')} (Express ${utils.version('express')})`
      const fn = pug.compile(template)
      res.status(500).send(fn({ title, error }))
    } catch (templateError) {
      console.error('Error loading error page template:', templateError)
      res.status(500).send('An error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'))
    }
  }
}
