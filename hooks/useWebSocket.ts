import { useEffect, useRef, useState } from 'react';
import io, { Socket } from 'socket.io-client';

export type ConnectionState = 'connecting' | 'connected' | 'disconnected';

export function useWebSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connected');
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const socketRef = useRef<Socket | null>(null);

  // WebSocket functionality temporarily disabled
  return {
    socket: null,
    connectionState: 'connected' as ConnectionState,
    activeUsers: 0,
  };
}
