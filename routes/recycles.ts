/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import { type Request, type Response } from 'express'
import { RecycleModel } from '../models/recycle'

import * as utils from '../lib/utils'

export const getRecycleItem = () => (req: Request, res: Response) => {
  try {
    if (!req.params.id || typeof req.params.id !== 'string') {
      return res.status(400).send('Invalid recycle item ID')
    }
    
    let id
    try {
      id = JSON.parse(req.params.id)
      if (id === null || (typeof id !== 'number' && typeof id !== 'string')) {
        return res.status(400).send('Invalid recycle item ID format')
      }
    } catch (err) {
      return res.status(400).send('Error parsing recycle item ID')
    }
    
    RecycleModel.findAll({
      where: {
        id: id
      }
    }).then((Recycle) => {
      return res.send(utils.queryResultToJson(Recycle))
    }).catch((_: unknown) => {
      return res.send('Error fetching recycled items. Please try again')
    })
  } catch (err) {
    return res.status(500).send('Server error processing request')
  }
}

export const blockRecycleItems = () => (req: Request, res: Response) => {
  const errMsg = { err: 'Sorry, this endpoint is not supported.' }
  return res.send(utils.queryResultToJson(errMsg))
}
