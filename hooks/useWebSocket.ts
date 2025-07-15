import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socketInstance = io(process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3001', {
      transports: ['websocket'],
      autoConnect: true,
    });

    // Setup event listeners
    socketInstance.on('connect', () => {
      console.log('WebSocket connected');
      setConnectionState('connected');
    });

    socketInstance.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnectionState('disconnected');
      // Attempt to reconnect after delay
      setTimeout(() => {
        if (socketRef.current) {
          socketRef.current.connect();
        }
      }, 3000);
    });

    socketInstance.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionState('disconnected');
    });

    socketInstance.on('users:update', (count: number) => {
      setActiveUsers(count);
    });

    socketRef.current = socketInstance;
    setSocket(socketInstance);

    // Cleanup on unmount
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  return {
    socket,
    connectionState,
    activeUsers,
  };
}
