'use client';

import { useState, useCallback } from 'react';

export type NotificationType = 'success' | 'error';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

export function useNotification() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const showNotification = useCallback((message: string, type: NotificationType) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    // Auto dismiss after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const dismissNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const NotificationComponent = useCallback(() => {
    if (notifications.length === 0) return null;

    return (
      <div className="fixed bottom-4 right-4 space-y-2 z-50">
        {notifications.map(notification => (
          <div
            key={notification.id}
            className={`
              p-4 rounded shadow-lg flex items-center justify-between
              ${notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}
            `}
          >
            <span>{notification.message}</span>
            <button
              onClick={() => dismissNotification(notification.id)}
              className="ml-4 text-white hover:text-gray-200 focus:outline-none"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    );
  }, [notifications, dismissNotification]);

  return {
    showNotification,
    NotificationComponent,
  };
}
