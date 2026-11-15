import { defineMiddleware } from 'astro:middleware';
import { createStarter, startBackgroundJobs } from './lib/background';

const ensureBackgroundJobs = createStarter(() => startBackgroundJobs());

export const onRequest = defineMiddleware(async (context, next) => {
  // Prerendering at build time must not start the worker; only live requests do.
  if (!context.isPrerendered) ensureBackgroundJobs();
  try {
    return await next();
  } catch (error) {
    // Path only, never the query string (it can hold a token). Astro then renders 500.astro.
    const { name, message, stack } =
      error instanceof Error ? error : { name: 'Error', message: String(error), stack: undefined };
    console.error(`request failed: ${context.request.method} ${context.url.pathname}`);
    console.error(stack ?? `${name}: ${message}`);
    throw error;
  }
});
