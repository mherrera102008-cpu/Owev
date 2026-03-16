// @ts-nocheck
// Stub file — replaced by `npx convex dev` at runtime.
// This file allows the Next.js build to resolve the @convex/_generated/api import
// before the real Convex _generated/ directory is created.

export const api: any = new Proxy(
  {},
  {
    get(_target, prop) {
      return new Proxy(
        {},
        {
          get(_t, fn) {
            return `${String(prop)}:${String(fn)}`;
          },
        }
      );
    },
  }
);

export const internal: any = api;
