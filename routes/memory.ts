/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response, type NextFunction } from 'express'
import path from 'node:path'
import { MemoryModel } from '../models/memory'
import { UserModel } from '../models/user'

export function addMemory () {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const safeFilename = req.file?.filename ? req.file.filename.replace(/[^a-zA-Z0-9._-]/g, '') : '';
      
      const baseDir = 'assets/public/images/uploads';
      const imagePath = path.join(baseDir, safeFilename);
      
      const record = {
        caption: req.body.caption,
        imagePath: imagePath,
        UserId: req.body.UserId
      }
      
      const memory = await MemoryModel.create(record)
      res.status(200).json({ status: 'success', data: memory })
    } catch (error) {
      next(error)
    }
  }
}

export function getMemories () {
  return async (req: Request, res: Response, next: NextFunction) => {
    const memories = await MemoryModel.findAll({ include: [UserModel] })
    res.status(200).json({ status: 'success', data: memories })
  }
}
