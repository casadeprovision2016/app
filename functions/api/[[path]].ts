/**
 * Cloudflare Pages Function - API Proxy
 * 
 * This function proxies API requests from the frontend to the Worker API.
 * It's useful for:
 * - Avoiding CORS issues
 * - Adding authentication headers
 * - Request/response transformation
 * 
 * Route: /api/*
 * Proxies to: Worker API (configured via VITE_API_URL)
 */

interface Env {
  VITE_API_URL: string;
}

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: { path: string[] };
}): Promise<Response> {
  const { request, env, params } = context;
  
  try {
    // Get the API base URL from environment
    const apiBaseUrl = env.VITE_API_URL || 'http://localhost:8787';
    
    // Construct the full path
    const path = params.path ? params.path.join('/') : '';
    const url = new URL(request.url);
    const targetUrl = `${apiBaseUrl}/api/${path}${url.search}`;
    
    // Clone the request and update the URL
    const modifiedRequest = new Request(targetUrl, {
      method: request.method,
      headers: request.headers,
      body: request.body,
      redirect: 'follow',
    });
    
    // Forward the request to the Worker API
    const response = await fetch(modifiedRequest);
    
    // Clone the response to modify headers
    const modifiedResponse = new Response(response.body, response);
    
    // Add CORS headers if needed
    modifiedResponse.headers.set('Access-Control-Allow-Origin', '*');
    modifiedResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    modifiedResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    return modifiedResponse;
  } catch (error) {
    console.error('API proxy error:', error);
    
    return new Response(
      JSON.stringify({
        error: {
          code: 'PROXY_ERROR',
          message: 'Failed to proxy request to API',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
      }),
      {
        status: 502,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function onRequestOptions(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}
