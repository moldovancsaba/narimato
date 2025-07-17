import { z } from 'zod';
import { rateLimit } from '@/lib/rate-limit';
import { getCurrentUser } from '@/lib/auth';
import { ProjectSchema } from '@/lib/validations/project';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { emitEvent } from '@/lib/socket';
import mongoose from 'mongoose';

/**
 * Rate limit configuration for adding cards to projects
 * Allows up to 500 requests within a 10-minute window
 * This prevents abuse while allowing reasonable usage patterns
 */
const addCardLimit = rateLimit({
  interval: '10m',
  uniqueTokenPerInterval: 500
});

/**
 * Input validation schema for addCardToProject
 * Ensures both IDs are non-empty strings and valid MongoDB ObjectIDs
 */
const addCardSchema = z.object({
  projectId: z.string().min(1).refine(
    id => ObjectId.isValid(id),
    { message: 'Invalid project ID format' }
  ),
  cardId: z.string().min(1).refine(
    id => ObjectId.isValid(id),
    { message: 'Invalid card ID format' }
  )
});

/**
 * Server action to add a card to a project
 * 
 * This function performs several important checks:
 * 1. Input validation using Zod schema
 * 2. Rate limiting to prevent abuse
 * 3. Authentication check using NextAuth session
 * 4. Authorization check for project access
 * 5. MongoDB transaction for data consistency
 * 6. Real-time updates via socket events
 * 
 * @param projectId - MongoDB ObjectID of the target project
 * @param cardId - MongoDB ObjectID of the card to add
 * @returns Object containing success status and message
 */
export async function addCardToProject(projectId: string, cardId: string) {
  try {
    // Step 1: Validate input parameters
    const validatedData = addCardSchema.parse({ projectId, cardId });

    // Step 2: Check rate limit
    try {
      await addCardLimit.check();
    } catch {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    // Step 3: Get current user (anonymous or authenticated)
    const user = await getCurrentUser();
    if (!user?.sessionId) {
      throw new Error('No valid session found');
    }

    // Step 4: Connect to MongoDB and start transaction
    await dbConnect();
    const session = await mongoose.startSession();

    try {
      await session.withTransaction(async () => {
        // Check project exists and user has permission
        const project = await mongoose.connection.collection('projects').findOne(
          {
            _id: new ObjectId(validatedData.projectId),
            $or: [
              { ownerId: user.sessionId },
              { 'members.sessionId': user.sessionId }
            ]
          },
          { session }
        );

        if (!project) {
          throw new Error('Project not found or access denied');
        }

        // Verify card exists
        const card = await mongoose.connection.collection('cards').findOne(
          { _id: new ObjectId(validatedData.cardId) },
          { session }
        );

        if (!card) {
          throw new Error('Card not found');
        }

        // Update project with new card
        await mongoose.connection.collection('projects').updateOne(
          { _id: new ObjectId(validatedData.projectId) },
          { 
            $addToSet: { cards: new ObjectId(validatedData.cardId) },
            $set: { updatedAt: new Date() }
          },
          { session }
        );
      });

      // Step 5: Emit real-time update event
      emitEvent('project:card:added', {
        projectId: validatedData.projectId,
        cardId: validatedData.cardId,
        timestamp: new Date().toISOString()
      });

      return {
        success: true,
        message: 'Card successfully added to project'
      };

    } finally {
      await session.endSession();
    }

  } catch (error) {
    // Handle all possible error types with appropriate messages
    const errorMessage = error instanceof Error 
      ? error.message
      : 'An unexpected error occurred while adding card to project';

    return {
      success: false,
      message: errorMessage
    };
  }
}
