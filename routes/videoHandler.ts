/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import fs from 'node:fs'
import path from 'node:path'
import pug from 'pug'
import config from 'config'
import { type Request, type Response } from 'express'
import { AllHtmlEntities as Entities } from 'html-entities'

import * as challengeUtils from '../lib/challengeUtils'
import { themes } from '../views/themes/themes'
import { challenges } from '../data/datacache'
import * as utils from '../lib/utils'

const entities = new Entities()

export const getVideo = () => {
  return (req: Request, res: Response) => {
    const path = videoPath()
    const stat = fs.statSync(path)
    const fileSize = stat.size
    const range = req.headers.range
    if (range) {
      const parts = range.replace(/bytes=/, '').split('-')
      const start = parseInt(parts[0], 10)
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
      const chunksize = (end - start) + 1
      const file = fs.createReadStream(path, { start, end })
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Location': '/assets/public/videos/owasp_promo.mp4',
        'Content-Type': 'video/mp4'
      }
      res.writeHead(206, head)
      file.pipe(res)
    } else {
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      }
      res.writeHead(200, head)
      fs.createReadStream(path).pipe(res)
    }
  }
}

export const promotionVideo = () => {
  return (req: Request, res: Response) => {
    try {
      const templatePath = path.resolve('views/promotionVideo.pug')
      fs.readFile(templatePath, function (err, buf) {
        try {
          if (err != null) {
            console.error('Error reading template file:', err)
            res.status(500).send('Error loading video page')
            return
          }
          
          let template = buf.toString()
          const subs = getSubsFromFile()

          challengeUtils.solveIf(challenges.videoXssChallenge, () => { return utils.contains(subs, '</script><script>alert(`xss`)</script>') })

          const themeKey = config.get<string>('application.theme') as keyof typeof themes
          const theme = themes[themeKey] || themes['bluegrey-lightgreen']
          template = template.replace(/_title_/g, entities.encode(config.get<string>('application.name')))
          template = template.replace(/_favicon_/g, favicon())
          template = template.replace(/_bgColor_/g, theme.bgColor)
          template = template.replace(/_textColor_/g, theme.textColor)
          template = template.replace(/_navColor_/g, theme.navColor)
          template = template.replace(/_primLight_/g, theme.primLight)
          template = template.replace(/_primDark_/g, theme.primDark)
          
          try {
            const fn = pug.compile(template)
            let compiledTemplate = fn()
            compiledTemplate = compiledTemplate.replace('<script id="subtitle"></script>', '<script id="subtitle" type="text/vtt" data-label="English" data-lang="en">' + subs + '</script>')
            res.send(compiledTemplate)
          } catch (compileError) {
            console.error('Error compiling template:', compileError)
            res.status(500).send('Error processing video page')
          }
        } catch (innerError) {
          console.error('Error in template processing:', innerError)
          res.status(500).send('Error processing video page')
        }
      })
    } catch (outerError) {
      console.error('Error in promotion video handler:', outerError)
      res.status(500).send('Error loading video page')
    }
  }
  
  function favicon () {
    try {
      return utils.extractFilename(config.get('application.favicon'))
    } catch (error) {
      console.error('Error extracting favicon:', error)
      return 'favicon.ico'
    }
  }
}

function getSubsFromFile () {
  try {
    const subtitles = config.get<string>('application.promotion.subtitles') ?? 'owasp_promo.vtt'
    const safeSubtitles = subtitles.replace(/[^a-zA-Z0-9._-]/g, '')
    const baseDir = path.resolve('frontend/dist/frontend/assets/public/videos')
    const filePath = path.resolve(baseDir, safeSubtitles)
    
    if (!filePath.startsWith(baseDir)) {
      return ''; // Return empty subtitles instead of throwing
    }
    
    const data = fs.readFileSync(filePath, 'utf8')
    return data.toString()
  } catch (error) {
    console.error('Error loading subtitles:', error)
    return '' // Return empty subtitles on error
  }
}

function videoPath () {
  try {
    const baseDir = path.resolve('frontend/dist/frontend/assets/public/videos')
    const defaultPath = path.resolve(baseDir, 'owasp_promo.mp4')
    
    if (config.get<string>('application.promotion.video') !== null) {
      const video = utils.extractFilename(config.get<string>('application.promotion.video'))
      const safeVideo = video.replace(/[^a-zA-Z0-9._-]/g, '')
      const filePath = path.resolve(baseDir, safeVideo)
      
      if (!filePath.startsWith(baseDir)) {
        console.error('Invalid video file path detected')
        return defaultPath
      }
      
      return filePath
    }
    
    return defaultPath
  } catch (error) {
    console.error('Error determining video path:', error)
    return path.resolve('frontend/dist/frontend/assets/public/videos', 'owasp_promo.mp4')
  }
}
