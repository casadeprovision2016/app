/**
 * Cloudflare Pages Functions - Global Middleware
 * 
 * This middleware runs before all Pages Functions.
 * It adds security headers and logging.
 */

interface Env {
  VITE_ENVIRONMENT: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> {
  const { request, env, next } = context;
  
  // Log request in development
  if (env.VITE_ENVIRONMENT === 'development') {
    console.log(`[Pages Function] ${request.method} ${new URL(request.url).pathname}`);
  }
  
  // Process the request
  const response = await next();
  
  // Add security headers to all responses
  const securityHeaders = {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
  };
  
  // Clone response to modify headers
  const modifiedResponse = new Response(response.body, response);
  
  Object.entries(securityHeaders).forEach(([key, value]) => {
    modifiedResponse.headers.set(key, value);
  });
  
  return modifiedResponse;
}
