/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import locales from '../data/static/locales.json'
import fs from 'node:fs'
import path from 'node:path'
import { type Request, type Response, type NextFunction } from 'express'

export function getLanguageList () { // TODO Refactor and extend to also load backend translations from /i18n/*json and calculate joint percentage/gauge
  return (req: Request, res: Response, next: NextFunction) => {
    const languages: Array<{ key: string, lang: any, icons: string[], shortKey: string, percentage: unknown, gauge: string }> = []
    let count = 0
    let enContent: any

    const baseDir = path.resolve('frontend/dist/frontend/assets/i18n')
    const enFilePath = path.resolve(baseDir, 'en.json')
    
    if (!enFilePath.startsWith(baseDir)) {
      return next(new Error('Invalid file path detected'))
    }
    
    fs.readFile(enFilePath, 'utf-8', (err, content) => {
      if (err != null) {
        next(new Error(`Unable to retrieve en.json language file: ${err.message}`))
      }
      
      try {
        if (!content || typeof content !== 'string' || content.length > 1000000) {
          return next(new Error('Invalid en.json language file format or size'))
        }
        enContent = JSON.parse(content)
        
        if (!enContent || typeof enContent !== 'object' || enContent === null) {
          return next(new Error('Invalid en.json language file structure'))
        }
      } catch (parseErr: unknown) {
        const errorMessage = parseErr instanceof Error ? parseErr.message : 'Unknown error'
        return next(new Error(`Error parsing en.json language file: ${errorMessage}`))
      }
      
      const i18nDir = path.resolve('frontend/dist/frontend/assets/i18n')
      
      fs.readdir(i18nDir, (err, languageFiles) => {
        if (err != null) {
          next(new Error(`Unable to read i18n directory: ${err.message}`))
        }
        languageFiles.forEach((fileName) => {
          const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '')
          const filePath = path.resolve(i18nDir, safeFileName)
          
          if (!filePath.startsWith(i18nDir)) {
            return next(new Error(`Invalid file path detected: ${fileName}`))
          }
          
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          fs.readFile(filePath, 'utf-8', async (err, content) => {
            if (err != null) {
              next(new Error(`Unable to retrieve ${safeFileName} language file: ${err.message}`))
            }
            
            try {
              if (!content || typeof content !== 'string' || content.length > 1000000) {
                return next(new Error(`Invalid ${safeFileName} language file format or size`))
              }
              const fileContent = JSON.parse(content)
              
              if (!fileContent || typeof fileContent !== 'object' || fileContent === null) {
                return next(new Error(`Invalid ${safeFileName} language file structure`))
              }
              const percentage = await calcPercentage(fileContent, enContent)
              const key = safeFileName.substring(0, safeFileName.indexOf('.'))
              const locale = locales.find((l) => l.key === key)
              const lang: any = {
                key,
                lang: fileContent.LANGUAGE,
                icons: locale?.icons,
                shortKey: locale?.shortKey,
                percentage,
                gauge: (percentage > 90 ? 'full' : (percentage > 70 ? 'three-quarters' : (percentage > 50 ? 'half' : (percentage > 30 ? 'quarter' : 'empty'))))
              }
              if (!(safeFileName === 'en.json' || safeFileName === 'tlh_AA.json')) {
                languages.push(lang)
              }
              count++
              if (count === languageFiles.length) {
                languages.push({ key: 'en', icons: ['gb', 'us'], shortKey: 'EN', lang: 'English', percentage: 100, gauge: 'full' })
                languages.sort((a, b) => a.lang.localeCompare(b.lang))
                res.status(200).json(languages)
              }
            } catch (parseErr: unknown) {
              const errorMessage = parseErr instanceof Error ? parseErr.message : 'Unknown error'
              next(new Error(`Error parsing ${safeFileName} language file: ${errorMessage}`))
            }
          })
        })
      })
    })

    async function calcPercentage (fileContent: any, enContent: any): Promise<number> {
      const totalStrings = Object.keys(enContent).length
      let differentStrings = 0
      return await new Promise((resolve, reject) => {
        try {
          for (const key in fileContent) {
            if (Object.prototype.hasOwnProperty.call(fileContent, key) && fileContent[key] !== enContent[key]) {
              differentStrings++
            }
          }
          resolve((differentStrings / totalStrings) * 100)
        } catch (err) {
          reject(err)
        }
      })
    }
  }
}
