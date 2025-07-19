'use client';

import { useGoogleLogin } from '@react-oauth/google';

export function LoginButton() {
  const login = useGoogleLogin({
    flow: 'auth-code',
    ux_mode: 'redirect',
    redirect_uri: process.env.NODE_ENV === 'production'
      ? 'https://narimato.vercel.app/api/auth/callback/google'
      : 'http://localhost:3000/api/auth/callback/google',
    onSuccess: (codeResponse) => {
      console.log('Login Success:', codeResponse);
    },
    onError: (error) => console.error('Login Failed:', error)
  });

  return (
    <button
      onClick={() => login()}
      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
    >
      Sign in
    </button>
  );
}
