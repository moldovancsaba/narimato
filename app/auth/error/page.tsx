import Link from 'next/link';

export default function AuthError({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const error = searchParams?.error || 'An error occurred during authentication';

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Authentication Error
          </h2>
          <p className="mt-2 text-sm text-red-600">{error}</p>
          <div className="mt-8">
            <Link
              href="/auth/signin"
              className="text-indigo-600 hover:text-indigo-500"
            >
              Try signing in again
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
