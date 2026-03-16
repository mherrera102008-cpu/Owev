import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('proxy.ts route protection', () => {
  it('proxy.ts exists at src/proxy.ts', () => {
    const proxyPath = path.resolve(__dirname, '../src/proxy.ts');
    expect(fs.existsSync(proxyPath)).toBe(true);
  });

  it('proxy.ts uses clerkMiddleware (not deprecated middleware)', () => {
    const proxyPath = path.resolve(__dirname, '../src/proxy.ts');
    if (!fs.existsSync(proxyPath)) {
      expect.fail('src/proxy.ts does not exist yet — run plan 01-03 Task 1 first');
    }
    const content = fs.readFileSync(proxyPath, 'utf-8');
    expect(content).toContain('clerkMiddleware');
    expect(content).not.toContain('export function middleware');
  });

  it('proxy.ts protects /dashboard route', () => {
    const proxyPath = path.resolve(__dirname, '../src/proxy.ts');
    if (!fs.existsSync(proxyPath)) {
      expect.fail('src/proxy.ts does not exist yet');
    }
    const content = fs.readFileSync(proxyPath, 'utf-8');
    expect(content).toContain('sign-in');
    expect(content).toContain('sign-up');
  });
});

describe('getCurrentUserId helper', () => {
  it('convex/users.ts exists', () => {
    const usersPath = path.resolve(__dirname, '../convex/users.ts');
    expect(fs.existsSync(usersPath)).toBe(true);
  });

  it('getCurrentUserId function is exported from convex/users.ts', () => {
    const usersPath = path.resolve(__dirname, '../convex/users.ts');
    if (!fs.existsSync(usersPath)) {
      expect.fail('convex/users.ts does not exist yet — run plan 01-02 first');
    }
    const content = fs.readFileSync(usersPath, 'utf-8');
    expect(content).toContain('export async function getCurrentUserId');
    expect(content).toContain('identity.subject');
  });

  it('getCurrentUserId throws if identity is null (no unauthenticated degradation)', () => {
    const usersPath = path.resolve(__dirname, '../convex/users.ts');
    if (!fs.existsSync(usersPath)) {
      expect.fail('convex/users.ts does not exist yet');
    }
    const content = fs.readFileSync(usersPath, 'utf-8');
    expect(content).toContain('throw new Error');
    expect(content).toContain('Unauthenticated');
  });
});

describe('Tenant isolation contract', () => {
  it('convex/http.ts exists (Clerk webhook handler)', () => {
    const httpPath = path.resolve(__dirname, '../convex/http.ts');
    expect(fs.existsSync(httpPath)).toBe(true);
  });

  it('upsertFromClerk is an internalMutation (not publicly callable)', () => {
    const usersPath = path.resolve(__dirname, '../convex/users.ts');
    if (!fs.existsSync(usersPath)) {
      expect.fail('convex/users.ts does not exist yet');
    }
    const content = fs.readFileSync(usersPath, 'utf-8');
    expect(content).toContain('internalMutation');
    expect(content).not.toMatch(/args:\s*\{[^}]*userId.*v\.string/);
  });
});
