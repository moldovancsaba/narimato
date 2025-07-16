import { getProviders } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { redirect } from 'next/navigation';
import ProviderButton from '../components/ProviderButton';

// Server Component that handles session check and provider setup
export default async function SignIn() {
  const session = await getServerSession(authOptions);

  // Redirect to home if already signed in
  if (session) {
    redirect('/');
  }

  const providers = await getProviders();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Sign in to Narimato
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Use your Google account to continue
          </p>
        </div>
        <div className="mt-8 space-y-6">
          {providers &&
            Object.values(providers).map((provider) => (
              <div key={provider.name} className="text-center">
                <ProviderButton
                  providerId={provider.id}
                  providerName={provider.name}
                />
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
