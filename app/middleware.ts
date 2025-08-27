import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limiting
const rateLimit = {
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  ipMap: new Map<string, { count: number; timestamp: number }>()
};

function cleanupRateLimit() {
  const now = Date.now();
  const expireTime = now - rateLimit.windowMs;
  
  rateLimit.ipMap.forEach((value, key) => {
    if (value.timestamp < expireTime) {
      rateLimit.ipMap.delete(key);
    }
  });
}

export async function middleware(request: NextRequest) {
  // Clean up old rate limit entries every request
  cleanupRateLimit();

  // Get client IP
  const ip = request.headers.get('x-forwarded-for') || request.headers.get('remote-addr') || 'unknown';
  const now = Date.now();

  // Basic rate limiting
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const ipData = rateLimit.ipMap.get(ip);
    
    if (ipData) {
      if (now - ipData.timestamp < rateLimit.windowMs) {
        if (ipData.count >= rateLimit.max) {
          return new NextResponse(
            JSON.stringify({
              error: 'Too many requests, please try again later'
            }),
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': '60'
              }
            }
          );
        }
        ipData.count++;
      } else {
        ipData.count = 1;
        ipData.timestamp = now;
      }
    } else {
      rateLimit.ipMap.set(ip, { count: 1, timestamp: now });
    }
  }

  // CORS headers
  const response = NextResponse.next();
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  if (process.env.NODE_ENV === 'production') {
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; img-src 'self' data: https:; style-src 'self' 'unsafe-inline';"
    );
    response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  return response;
}
