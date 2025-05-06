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
        processZipInMemory(file.buffer, next);
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

function processZipInMemory(buffer: Buffer, next: NextFunction) {
  try {
    const targetDir = path.resolve('uploads/complaints');
    try {
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    } catch (mkdirError) {
      console.error('Error creating target directory:', mkdirError);
      return next(mkdirError);
    }
    
    const { Readable } = require('node:stream');
    const bufferStream = new Readable();
    bufferStream.push(buffer);
    bufferStream.push(null); // Signal the end of the stream
    
    bufferStream
      .pipe(unzipper.Parse())
      .on('entry', function (entry: any) {
        try {
          const entryPath = entry.path;
          
          // Check for legal.md to solve the challenge
          if (entryPath === 'legal.md') {
            challengeUtils.solveIf(challenges.fileWriteChallenge, () => true);
          }
          
          const randomFilename = crypto.randomUUID() + '.bin';
          const outputPath = path.resolve(targetDir, randomFilename);
          
          if (!outputPath.startsWith(targetDir)) {
            console.error('Security check failed: Path would be outside target directory');
            return entry.autodrain();
          }
          
          const writeStream = fs.createWriteStream(outputPath);
          
          writeStream.on('error', function (writeErr) {
            console.error('Error writing to file:', writeErr);
            entry.autodrain();
          });
          
          entry.pipe(writeStream);
        } catch (entryError) {
          console.error('Error processing zip entry:', entryError);
          entry.autodrain();
        }
      })
      .on('error', function (unzipErr: unknown) {
        console.error('Error unzipping file:', unzipErr);
        next(unzipErr);
      });
  } catch (processError) {
    console.error('Error processing zip buffer:', processError);
    next(processError);
  }
}

function checkUploadSize ({ file }: Request, res: Response, next: NextFunction) {
  if (file != null) {
    challengeUtils.solveIf(challenges.uploadSizeChallenge, () => { return file?.size > 100000 })
  }
  next()
}

function checkFileType ({ file }: Request, res: Response, next: NextFunction) {
  try {
    let fileType = '';
    if (file?.originalname) {
      const lastDotIndex = String(file.originalname).lastIndexOf('.');
      if (lastDotIndex !== -1) {
        fileType = String(file.originalname).substring(lastDotIndex + 1).toLowerCase();
      }
    }
    
    challengeUtils.solveIf(challenges.uploadTypeChallenge, () => {
      return !(fileType === 'pdf' || fileType === 'xml' || fileType === 'zip' || fileType === 'yml' || fileType === 'yaml')
    })
    next();
  } catch (error) {
    console.error('Error checking file type:', error);
    next(error);
  }
}

function handleXmlUpload ({ file }: Request, res: Response, next: NextFunction) {
  try {
    let isXmlFile = false;
    if (file?.originalname) {
      const filename = String(file.originalname).toLowerCase();
      isXmlFile = filename.endsWith('.xml');
    }
    
    if (isXmlFile) {
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
              return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + utils.trunc(xmlString, 400) + ' (XML file)'))
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
                return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + vmError.message + ' (XML file)'))
              }
            }
          } catch (dataError: any) {
            console.error('Error processing XML data:', dataError)
            res.status(410)
            return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + dataError.message + ' (XML file)'))
          }
        } catch (bufferError: any) {
          console.error('Error converting buffer to string:', bufferError)
          res.status(410)
          return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: Error processing file (XML file)'))
        }
      } else {
        res.status(410)
        return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (XML file)'))
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
    let isYamlFile = false;
    if (file?.originalname) {
      const filename = String(file.originalname).toLowerCase();
      isYamlFile = filename.endsWith('.yml') || filename.endsWith('.yaml');
    }
    
    if (isYamlFile) {
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
              return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + utils.trunc(yamlString, 400) + ' (YAML file)'))
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
                return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + vmError.message + ' (YAML file)'))
              }
            }
          } catch (dataError: any) {
            console.error('Error processing YAML data:', dataError)
            res.status(410)
            return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: ' + dataError.message + ' (YAML file)'))
          }
        } catch (bufferError: any) {
          console.error('Error converting buffer to string:', bufferError)
          res.status(410)
          return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons: Error processing file (YAML file)'))
        }
      } else {
        res.status(410)
        return next(new Error('B2B customer complaints via file upload have been deprecated for security reasons (YAML file)'))
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
