import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

/**
 * Constant-time string comparison using SHA-256 digests so unequal lengths
 * never short-circuit timing side-channels.
 */
export function timingSafeStringEqual(a?: unknown, b?: unknown): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;
  const hashA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const hashB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

/**
 * Extracts normalized client IP respecting reverse-proxy headers.
 */
export function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    return xff.split(',')[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

interface RateBucket {
  count: number;
  resetAt: number;
}

export interface RateLimiterOptions {
  name: string;
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  errorMessage?: string;
}

/**
 * In-memory fixed-window rate limiter with bounded auto-pruning.
 */
export function createRateLimiter(options: RateLimiterOptions) {
  const buckets = new Map<string, RateBucket>();
  let lastPrune = Date.now();

  const prune = (now: number) => {
    if (now - lastPrune < 60_000 && buckets.size < 2000) return;
    lastPrune = now;
    for (const [k, v] of buckets.entries()) {
      if (v.resetAt <= now) {
        buckets.delete(k);
      }
    }
  };

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    prune(now);

    const keySuffix = options.keyGenerator ? options.keyGenerator(req) : getClientIp(req);
    const key = `${options.name}:${keySuffix}`;
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + options.windowMs });
      res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
      res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.maxRequests - 1)));
      return next();
    }

    existing.count += 1;
    const remaining = Math.max(0, options.maxRequests - existing.count);
    res.setHeader('X-RateLimit-Limit', String(options.maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));

    if (existing.count > options.maxRequests) {
      const retryAfterSec = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        success: false,
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfterSec,
        error:
          options.errorMessage ||
          `Trop de requêtes effectuées. Veuillez patienter ${retryAfterSec} secondes avant de réessayer.`
      });
    }

    return next();
  };
}

interface LoginFailureRecord {
  failures: number;
  firstFailureAt: number;
  lockedUntil: number;
}

/**
 * Dedicated Brute-Force Lockout Guard for authentication attempts.
 */
export class LoginAttemptGuard {
  private attempts = new Map<string, LoginFailureRecord>();
  private readonly maxFailures: number;
  private readonly windowMs: number;
  private readonly lockoutMs: number;

  constructor(maxFailures = 8, windowMs = 15 * 60 * 1000, lockoutMs = 15 * 60 * 1000) {
    this.maxFailures = maxFailures;
    this.windowMs = windowMs;
    this.lockoutMs = lockoutMs;
  }

  private makeKeys(ip: string, identifier?: string): string[] {
    const keys = [`ip:${ip}`];
    const cleanId = (identifier || '').trim().toLowerCase();
    if (cleanId) {
      keys.push(`id:${ip}:${cleanId}`);
    }
    return keys;
  }

  private pruneIfNeeded(now: number) {
    if (this.attempts.size < 1000) return;
    for (const [k, rec] of this.attempts.entries()) {
      if (rec.lockedUntil <= now && now - rec.firstFailureAt > this.windowMs) {
        this.attempts.delete(k);
      }
    }
  }

  public isLocked(ip: string, identifier?: string): { locked: boolean; retryAfterSeconds: number } {
    const now = Date.now();
    this.pruneIfNeeded(now);
    let maxLockedUntil = 0;

    for (const key of this.makeKeys(ip, identifier)) {
      const rec = this.attempts.get(key);
      if (rec && rec.lockedUntil > now) {
        if (rec.lockedUntil > maxLockedUntil) maxLockedUntil = rec.lockedUntil;
      }
    }

    if (maxLockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((maxLockedUntil - now) / 1000))
      };
    }

    return { locked: false, retryAfterSeconds: 0 };
  }

  public recordFailure(ip: string, identifier?: string): { lockedNow: boolean; retryAfterSeconds: number; failures: number } {
    const now = Date.now();
    let maxFailuresSeen = 0;
    let lockedUntilMax = 0;

    // IP limit is slightly higher so shared office/NAT Wi-Fi isn't falsely locked out by 1 user typo
    for (const key of this.makeKeys(ip, identifier)) {
      const threshold = key.startsWith('ip:') ? this.maxFailures * 3 : this.maxFailures;
      const existing = this.attempts.get(key);
      if (!existing || now - existing.firstFailureAt > this.windowMs) {
        this.attempts.set(key, { failures: 1, firstFailureAt: now, lockedUntil: 0 });
        maxFailuresSeen = Math.max(maxFailuresSeen, 1);
      } else {
        existing.failures += 1;
        if (existing.failures >= threshold) {
          existing.lockedUntil = now + this.lockoutMs;
          lockedUntilMax = Math.max(lockedUntilMax, existing.lockedUntil);
        }
        maxFailuresSeen = Math.max(maxFailuresSeen, existing.failures);
      }
    }

    return {
      lockedNow: lockedUntilMax > now,
      retryAfterSeconds: lockedUntilMax > now ? Math.ceil((lockedUntilMax - now) / 1000) : 0,
      failures: maxFailuresSeen
    };
  }

  public recordSuccess(ip: string, identifier?: string): void {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (cleanId) {
      this.attempts.delete(`id:${ip}:${cleanId}`);
    }
    this.attempts.delete(`ip:${ip}`);
  }
}

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Recursively clones an object while stripping prototype-pollution keys.
 */
export function stripDangerousKeys<T>(input: T, depth = 0): T {
  if (depth > 20 || input === null || typeof input !== 'object') {
    return input;
  }
  if (Array.isArray(input)) {
    return input.map(item => stripDangerousKeys(item, depth + 1)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (DANGEROUS_KEYS.has(k)) continue;
    clean[k] = stripDangerousKeys(v, depth + 1);
  }
  return clean as T;
}

export function sanitizeRequestMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = stripDangerousKeys(req.body);
  }
  next();
}

const WEAK_COMMON_PASSWORDS = new Set([
  'admin123',
  '123456',
  '1234567',
  '12345678',
  '123456789',
  '1234567890',
  'password',
  'password123',
  'qwerty',
  'qwerty123',
  'azerty',
  'azerty123',
  '000000',
  '00000000',
  '111111',
  '11111111',
  'fariousy',
  'fariousy123',
  'maroc123',
  'abcdef',
  'abcdefgh'
]);

/**
 * Validates new/changed passwords against trivial/leaked defaults.
 */
export function validatePasswordStrength(password: string): { valid: boolean; error?: string } {
  const clean = (password || '').trim();
  if (clean.length < 8) {
    return {
      valid: false,
      error: 'Le mot de passe doit contenir au moins 8 caractères pour des raisons de sécurité.'
    };
  }
  if (WEAK_COMMON_PASSWORDS.has(clean.toLowerCase())) {
    return {
      valid: false,
      error: 'Ce mot de passe est trop courant ou facile à deviner. Choisissez un mot de passe plus robuste.'
    };
  }
  return { valid: true };
}
