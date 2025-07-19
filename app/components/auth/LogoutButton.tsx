'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      // Clear session from server
      await fetch('/api/auth/session', {
        method: 'DELETE',
      });
      
      // Clear local storage
      localStorage.removeItem('user_info');
      localStorage.removeItem('access_token');
      localStorage.removeItem('google_token');
      
      // Force reload to clear any client state
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white"
    >
      Sign out
    </button>
  );
}
