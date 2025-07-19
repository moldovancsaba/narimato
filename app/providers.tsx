'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <GoogleOAuthProvider clientId="114791157291-7t7fjm8ovdmeeim1v1h80tdoue6uaths.apps.googleusercontent.com">
      {children}
    </GoogleOAuthProvider>
  );
}
