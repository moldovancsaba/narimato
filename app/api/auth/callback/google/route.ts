import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  
  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.NODE_ENV === 'production'
          ? 'https://narimato.vercel.app/api/auth/callback/google'
          : 'http://localhost:3000/api/auth/callback/google',
        grant_type: 'authorization_code',
      }),
    }).then(res => res.json());

    if (tokenResponse.error) {
      console.error('Token Error:', tokenResponse);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Get user info
    const userInfo = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenResponse.access_token}`,
      },
    }).then(res => res.json());

    // Create response with redirect
    const response = NextResponse.redirect(new URL('/dashboard', request.url));

    // Set session cookie
    response.cookies.set('session', JSON.stringify({
      access_token: tokenResponse.access_token,
      user: userInfo
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Callback Error:', error);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
