/*
 * Copyright (c) 2014-2025 Bjoern Kimminich & the OWASP Juice Shop contributors.
 * SPDX-License-Identifier: MIT
 */

import jwt from 'jsonwebtoken'
import * as security from '../../lib/insecurity'

/**
 * Helper functions for generating test credentials and tokens
 * Used to avoid hard-coded credentials in test files
 */

/**
 * Generates an unsigned JWT token for testing
 * @param email Email to include in the token payload
 * @returns Unsigned JWT token
 */
export const generateUnsignedToken = (email: string): string => {
  const header = { alg: 'none', typ: 'JWT' }
  const payload = {
    data: { email },
    iat: 1508639612,
    exp: 9999999999
  }

  const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64').replace(/=/g, '')
  const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64').replace(/=/g, '')

  return `${headerBase64}.${payloadBase64}.`
}

/**
 * Generates an expired JWT token for testing
 * @returns Expired JWT token
 */
export const generateExpiredToken = (): string => {
  return 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdGF0dXMiOiJzdWNjZXNzIiwiZGF0YSI6eyJpZCI6MSwidXNlcm5hbWUiOiIiLCJlbWFpbCI6ImFkbWluQGp1aWNlLXNoLm9wIiwicGFzc3dvcmQiOiIwMTkyMDIzYTdiYmQ3MzI1MDUxNmYwNjlkZjE4YjUwMCIsInJvbGUiOiJhZG1pbiIsImxhc3RMb2dpbklwIjoiMC4wLjAuMCIsInByb2ZpbGVJbWFnZSI6ImRlZmF1bHQuc3ZnIiwidG90cFNlY3JldCI6IiIsImlzQWN0aXZlIjp0cnVlLCJjcmVhdGVkQXQiOiIyMDE5LTA4LTE5IDE1OjU2OjE1LjYyOSArMDA6MDAiLCJ1cGRhdGVkQXQiOiIyMDE5LTA4LTE5IDE1OjU2OjE1LjYyOSArMDA6MDAiLCJkZWxldGVkQXQiOm51bGx9LCJpYXQiOjE1NjYyMzAyMjQsImV4cCI6MTU2NjI0ODIyNH0.FL0kkcInY5sDMGKeLHfEOYDTQd3BjR6_mK7Tcm_RH6iCLotTSRRoRxHpLkbtIQKqBFIt14J4BpLapkzG7ppRWcEley5nego-4iFOmXQvCBz5ISS3HdtM0saJnOe0agyVUen3huFp4F2UCth_y2ScjMn_4AgW66cz8NSFPRVpC8g'
}

/**
 * Generates an invalid authorization token for testing
 * @returns Invalid authorization token
 */
export const generateInvalidAuthToken = (): string => {
  return 'InvalidAuthToken'
}

/**
 * Generates a malformed authorization header for testing
 * @returns Malformed authorization header
 */
export const generateMalformedAuthHeader = (): string => {
  return 'BoarBeatsBear'
}

/**
 * Generates a forged token HMAC-signed with public RSA-key for testing
 * @param email Email to include in the token payload
 * @returns Forged token
 */
export const generateForgedToken = (email: string): string => {
  const payload = {
    data: { email },
    iat: 1582221675
  }
  return jwt.sign(payload, security.publicKey, { algorithm: 'HS256' })
}
