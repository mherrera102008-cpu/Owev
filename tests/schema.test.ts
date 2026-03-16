import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Convex schema', () => {
  it('schema.ts exists at convex/schema.ts', () => {
    const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
    expect(fs.existsSync(schemaPath)).toBe(true);
  });

  it('schema.ts contains tenants table definition', () => {
    const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
    if (!fs.existsSync(schemaPath)) {
      expect.fail('convex/schema.ts does not exist yet — run plan 01-02 Task 1 first');
    }
    const content = fs.readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('tenants');
  });

  it('schema.ts contains by_owner index', () => {
    const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
    if (!fs.existsSync(schemaPath)) {
      expect.fail('convex/schema.ts does not exist yet');
    }
    const content = fs.readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('by_owner');
  });

  it('schema.ts contains invoices table definition', () => {
    const schemaPath = path.resolve(__dirname, '../convex/schema.ts');
    if (!fs.existsSync(schemaPath)) {
      expect.fail('convex/schema.ts does not exist yet');
    }
    const content = fs.readFileSync(schemaPath, 'utf-8');
    expect(content).toContain('invoices');
  });
});
