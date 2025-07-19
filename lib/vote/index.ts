import { retry } from '@/lib/utils/retry';
import { createLogger } from '@/lib/logger';
import { voteSchema } from './validation';
import { Card } from '@/models/Card';
import dbConnect from '@/lib/mongodb';
import type { z } from 'zod';

const logger = createLogger('vote-record');

type VoteData = z.infer<typeof voteSchema>;

export async function recordVote(voteData: VoteData) {
  // We'll retry the entire vote recording operation
  return retry(
    async () => {
      await dbConnect();

      const [winner, loser] = await Promise.all([
        Card.findById(voteData.winnerId),
        Card.findById(voteData.loserId),
      ]);

      if (!winner || !loser) {
        throw new Error('One or both cards not found');
      }

      // Core vote recording logic...
      await Promise.all([
        winner.save(),
        loser.save()
      ]);

      return {
        winner: winner.toObject(),
        loser: loser.toObject()
      };
    },
    {
      retries: 3,
      backoff: true,
      onRetry: (error, attempt) => {
        logger.warn('Vote recording retry', {
          attempt,
          error: error.message,
          voteData: {
            winnerId: voteData.winnerId,
            loserId: voteData.loserId,
            projectId: voteData.projectId,
            sessionId: voteData.sessionId,
            sessionType: voteData.sessionType
          }
        });
      }
    }
  );
}
