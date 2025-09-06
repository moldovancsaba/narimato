import { z } from 'zod';

export const startSchema = z.object({
  deckTag: z.string().min(1)
});

export const voteSchema = z.object({
  winner: z.string().uuid(),
  loser: z.string().uuid()
}).refine(({ winner, loser }) => winner !== loser, {
  message: 'winner and loser must differ'
});

