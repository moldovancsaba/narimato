'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface UserInfo {
  name?: string;
  email?: string;
  picture?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    // Try to get user info from localStorage first for immediate display
    const storedUserInfo = localStorage.getItem('user_info');
    if (storedUserInfo) {
      setUserInfo(JSON.parse(storedUserInfo));
    }

    // Then verify session with the server
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (!data || !data.user) {
          // No valid session, redirect to home
          router.push('/');
          return;
        }
        // Update user info from session if different
        setUserInfo(data.user);
      })
      .catch(error => {
        console.error('Failed to verify session:', error);
        router.push('/');
      });
  }, [router]);

  if (!userInfo) {
    return <div>Loading...</div>;
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="md:flex md:items-center md:justify-between mb-8">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl font-bold leading-7 text-gray-900 dark:text-white sm:truncate sm:text-3xl sm:tracking-tight">
              Welcome back, {userInfo.name}
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Projects</h3>
              <div className="mt-4">
                <p className="text-gray-500 dark:text-gray-400">No projects yet</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Cards</h3>
              <div className="mt-4">
                <p className="text-gray-500 dark:text-gray-400">No cards yet</p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h3>
              <div className="mt-4">
                <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
