import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { access_token, user_info } = body;

    if (!access_token || !user_info) {
      return NextResponse.json({ error: 'Invalid session data' }, { status: 400 });
    }

    const response = NextResponse.json({ status: 'success' });
    
    // Set session cookie
    response.cookies.set('session', JSON.stringify({
      access_token,
      user: user_info
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('Session creation failed:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const session = request.cookies.get('session');
  
  if (!session) {
    return NextResponse.json(null);
  }

  try {
    const sessionData = JSON.parse(session.value);
    return NextResponse.json(sessionData);
  } catch {
    return NextResponse.json(null);
  }
}

export async function DELETE() {
  const response = NextResponse.json({ status: 'success' });
  
  // Clear session cookie
  response.cookies.set('session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immediately
  });

  return response;
}
