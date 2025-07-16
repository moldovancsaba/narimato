'use client';

import { signIn } from 'next-auth/react';

interface ProviderButtonProps {
  providerId: string;
  providerName: string;
}

// Client component that handles the sign-in interaction
export default function ProviderButton({ providerId, providerName }: ProviderButtonProps) {
  return (
    <button
      onClick={() => signIn(providerId, { callbackUrl: '/' })}
      className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
    >
      Sign in with {providerName}
    </button>
  );
}
