import { Socket } from 'socket.io';
import { toast } from 'react-toastify';

// Event type definitions
export type CardAddedEvent = {
  projectId: string;
  cardId: string;
  timestamp: string; // ISO 8601 with milliseconds
};

// Server-side socket handler setup
export const setupServerSocketHandlers = (socket: Socket) => {
  socket.on('card:add', async (data: CardAddedEvent) => {
    try {
      // Validate event data
      if (!data.projectId || !data.cardId || !data.timestamp) {
        throw new Error('Invalid card data: missing required fields');
      }

      // Validate timestamp format (ISO 8601 with milliseconds)
      const timestampRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
      if (!timestampRegex.test(data.timestamp)) {
        throw new Error('Invalid timestamp format. Must be ISO 8601 with milliseconds (YYYY-MM-DDTHH:mm:ss.sssZ)');
      }

      // Join the project room if not already joined
      socket.join(data.projectId);

      // Broadcast to all clients in the project room
      socket.to(data.projectId).emit('card:added', data);

    } catch (error) {
      console.error('Error processing card:add event:', error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Failed to process card addition',
        timestamp: new Date().toISOString()
      });
    }
  });
};

// Client-side socket handler setup
export const setupClientSocketHandlers = (socket: Socket) => {
  socket.on('card:added', (data: CardAddedEvent) => {
    try {
      // Update UI state through application state management
      // (implementation depends on your state management solution)
      
      // Show success notification
      toast.success('Card added successfully');
      
      // Trigger card list refresh
      // This should be implemented according to your app's state management
      // For example, emit an event or call a refresh function
      
      console.info('Card added:', {
        projectId: data.projectId,
        cardId: data.cardId,
        timestamp: data.timestamp
      });
      
    } catch (error) {
      console.error('Error handling card:added event:', error);
      toast.error('Failed to update card list');
    }
  });
};
