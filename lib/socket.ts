type EventPayload = Record<string, any>;

/**
 * Emits a socket event for real-time communication
 * Can be used to send updates to clients via WebSocket
 * 
 * @param event - The event name to be emitted
 * @param payload - Optional data to send with the event
 */
export function emitEvent(event: string, payload?: EventPayload) {
  console.log(`Event emitted: ${event}`, payload);
  // Placeholder for actual socket.io implementation
  // This would use the socket server's emit function, e.g.
  // io.to(room).emit(event, payload);
}
