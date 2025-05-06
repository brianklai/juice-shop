/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import os from 'node:os'
import fs from 'node:fs'
import vm from 'node:vm'
import path from 'node:path'
import yaml from 'js-yaml'
import libxml from 'libxmljs'
import unzipper from 'unzipper'
import crypto from 'node:crypto'
import { type NextFunction, type Request, type Response } from 'express'

import * as challengeUtils from '../lib/challengeUtils'
import { challenges } from '../data/datacache'
import * as utils from '../lib/utils'

function ensureFileIsPassed ({ file }: Request, res: Response, next: NextFunction) {
  if (file != null) {
    next()
  } else {
    return res.status(400).json({ error: 'File is not passed' })
  }
}

const TEMP_DIR = path.join(os.tmpdir(), 'juice-shop-uploads');

try {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
} catch (err) {
  console.error('Error creating temporary directory:', err);
}

function handleZipFileUpload ({ file }: Request, res: Response, next: NextFunction) {
  try {
    if (utils.endsWith(file?.originalname.toLowerCase(), '.zip')) {
      if (((file?.buffer) != null) && utils.isChallengeEnabled(challenges.fileWriteChallenge)) {
        const buffer = file.buffer
        
        const tempFilePath = path.join(TEMP_DIR, `${crypto.randomUUID()}.zip`);
        
        try {
          fs.writeFileSync(tempFilePath, buffer);
          
          processZipFile(tempFilePath, next);
          
        } catch (fileError) {
          console.error('Error handling file operations:', fileError);
          next(fileError);
        }
      }
      res.status(204).end();
    } else {
      next();
    }
  } catch (outerError) {
    console.error('Error in zip file upload handler:', outerError);
    next(outerError);
  }
}

function processZipFile(zipFilePath: string, next: NextFunction) {
  try {
    const readStream = fs.createReadStream(zipFilePath);
    
    readStream.on('error', function (readErr) {
      console.error('Error reading temp file:', readErr);
      cleanupTempFile(zipFilePath);
      next(readErr);
    });
    
    readStream
      .pipe(unzipper.Parse())
      .on('entry', function (entry: any) {
        try {
          const fileName = entry.path;
          
          const safeFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '');
          const targetDir = path.resolve('uploads/complaints');
          const absolutePath = path.resolve(targetDir, safeFileName);
          
          const legalPath = path.resolve('ftp/legal.md');
          challengeUtils.solveIf(challenges.fileWriteChallenge, () => { 
            return fileName === 'legal.md' && legalPath === path.resolve('ftp/legal.md');
          });
          
          if (absolutePath.startsWith(targetDir)) {
            const writeStream = fs.createWriteStream(absolutePath);
            
            writeStream.on('error', function (writeErr) {
              console.error('Error writing to file:', writeErr);
              next(writeErr);
            });
            
            entry.pipe(writeStream);
          } else {
            entry.autodrain();
          }
        } catch (entryError) {
          console.error('Error processing zip entry:', entryError);
          entry.autodrain();
        }
      })
      .on('error', function (unzipErr: unknown) {
        console.error('Error unzipping file:', unzipErr);
        cleanupTempFile(zipFilePath);
        next(unzipErr);
      })
      .on('finish', function() {
        cleanupTempFile(zipFilePath);
      });
  } catch (processError) {
    console.error('Error processing zip file:', processError);
    cleanupTempFile(zipFilePath);
    next(processError);
  }
}

function cleanupTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (unlinkErr) {
    console.error('Error removing temp file:', unlinkErr);
  }
}

function checkUploadSize ({ file }: Request, res: Response, next: NextFunction) {
  if (file != null) {
    challengeUtils.solveIf(challenges.uploadSizeChallenge, () => { return file?.size > 100000 })
  }
  next()
}

function checkFileType ({ file }: Request, res: Response, next: NextFunction) {
  const fileType = file?.originalname.substr(file.originalname.lastIndexOf('.') + 1).toLowerCase()
  challengeUtils.solveIf(challenges.uploadTypeChallenge, () => {
    return !(fileType === 'pdf' || fileType === 'xml' || fileType === 'zip' || fileType === 'yml' || fileType === 'yaml')
  })
  next()
}

function handleXmlUpload ({ file }: Request, res: Response, next: NextFunction) {
  try {
    if (utils.endsWith(file?.originalname.toLowerCase(), '.xml')) {
      challengeUtils.solveIf(challenges.deprecatedInterfaceChallenge, () => { return true })
      if (((file?.buffer) != null) && utils.isChallengeEnabled(challenges.deprecatedInterfaceChallenge)) { // XXE attacks in Docker/Heroku containers regularly cause "segfault" crashes
        try {
          const data = file.buffer.toString()
          try {
            if (typeof data !== 'string' || data.length > 10000) {
              throw new Error('Invalid XML data format or size')
            }
            
            try {
              const sandbox = { libxml, data }
              vm.createContext(sandbox)
              const xmlDoc = vm.runInContext('libxml.parseXml(data, { noblanks: true, noent: true, nocdata: true })', sandbox, { timeout: 2000 })
              const xmlString = xmlDoc.toString(false)
              challengeUtils.solveIf(challenges.xxeFileDisclosureChallenge, () => { return (utils.matchesEtcPasswdFile(xmlString) || utils.matchesSystemIniFile(xmlString)) })
              res.status(410)
              return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + utils.trunc(xmlString, 400) + ' (' + file.originalname + ')'))
            } catch (vmError: any) {
              console.error('Error in VM execution:', vmError)
              if (utils.contains(vmError.message, 'Script execution timed out')) {
                if (challengeUtils.notSolved(challenges.xxeDosChallenge)) {
                  challengeUtils.solve(challenges.xxeDosChallenge)
                }
                res.status(503)
                return next(new Error('Sorry, we are temporarily not available! Please try again later.'))
              } else {
                res.status(410)
                return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + vmError.message + ' (' + file.originalname + ')'))
              }
            }
          } catch (dataError: any) {
            console.error('Error processing XML data:', dataError)
            res.status(410)
            return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + dataError.message + ' (' + file.originalname + ')'))
          }
        } catch (bufferError: any) {
          console.error('Error converting buffer to string:', bufferError)
          res.status(410)
          return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: Error processing file (' + file.originalname + ')'))
        }
      } else {
        res.status(410)
        return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
      }
    }
    return next()
  } catch (outerError) {
    console.error('Error in XML upload handler:', outerError)
    res.status(500)
    return next(new Error('Error processing XML upload'))
  }
}

function handleYamlUpload ({ file }: Request, res: Response, next: NextFunction) {
  try {
    if (utils.endsWith(file?.originalname.toLowerCase(), '.yml') || utils.endsWith(file?.originalname.toLowerCase(), '.yaml')) {
      challengeUtils.solveIf(challenges.deprecatedInterfaceChallenge, () => { return true })
      if (((file?.buffer) != null) && utils.isChallengeEnabled(challenges.deprecatedInterfaceChallenge)) {
        try {
          const data = file.buffer.toString()
          try {
            if (typeof data !== 'string' || data.length > 10000) {
              throw new Error('Invalid YAML data format or size')
            }
            
            try {
              const sandbox = { yaml, data }
              vm.createContext(sandbox)
              const yamlString = vm.runInContext('JSON.stringify(yaml.load(data))', sandbox, { timeout: 2000 })
              res.status(410)
              return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + utils.trunc(yamlString, 400) + ' (' + file.originalname + ')'))
            } catch (vmError: any) {
              console.error('Error in VM execution:', vmError)
              if (utils.contains(vmError.message, 'Invalid string length') || utils.contains(vmError.message, 'Script execution timed out')) {
                if (challengeUtils.notSolved(challenges.yamlBombChallenge)) {
                  challengeUtils.solve(challenges.yamlBombChallenge)
                }
                res.status(503)
                return next(new Error('Sorry, we are temporarily not available! Please try again later.'))
              } else {
                res.status(410)
                return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + vmError.message + ' (' + file.originalname + ')'))
              }
            }
          } catch (dataError: any) {
            console.error('Error processing YAML data:', dataError)
            res.status(410)
            return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + dataError.message + ' (' + file.originalname + ')'))
          }
        } catch (bufferError: any) {
          console.error('Error converting buffer to string:', bufferError)
          res.status(410)
          return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: Error processing file (' + file.originalname + ')'))
        }
      } else {
        res.status(410)
        return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (' + file?.originalname + ')'))
      }
    }
    res.status(204).end()
  } catch (outerError) {
    console.error('Error in YAML upload handler:', outerError)
    res.status(500)
    return next(new Error('Error processing YAML upload'))
  }
}

export {
  ensureFileIsPassed,
  handleZipFileUpload,
  checkUploadSize,
  checkFileType,
  handleXmlUpload,
  handleYamlUpload
}
