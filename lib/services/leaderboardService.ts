import { Card, ICard } from '@/models/Card';
import { PersonalRanking, IPersonalRanking } from '@/models/PersonalRanking';
import dbConnect from '@/lib/mongodb';

export interface LeaderboardEntry {
  rank: number;
  totalVotes: number;
  title: string;
  content: string;
  type: 'image' | 'text';
  imageAlt?: string;
  description?: string;
  slug: string;
  hashtags: string[];
  likes: number;
  dislikes: number;
  globalScore: number;
  translations: { locale: string; title: string; content: string; description?: string; }[];
  projectRankings: { projectId: string; rank: number; votes: number; lastVotedAt?: Date; }[];
  isDeleted: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  projectRank?: number;
}

export class LeaderboardService {
  /**
   * Retrieves global leaderboard based on ELO ratings
   * @param limit Number of entries to return
   * @param page Page number (1-based)
   * @returns Array of leaderboard entries with ranking information
   */
  static async getGlobalLeaderboard(
    limit: number = 10,
    page: number = 1
  ): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    pages: number;
  }> {
    await dbConnect();

    // Calculate total cards and pages
    // readyForVoting check removed - all cards are available for voting
    const query = { isDeleted: false };
    const total = await Card.countDocuments(query);
    const pages = Math.ceil(total / limit);

    // Get sorted cards with pagination
    const cards = await Card.find(query)
      .sort({ globalScore: -1, likes: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    // Transform to leaderboard entries
    const entries: LeaderboardEntry[] = cards.map((card, index) => ({
      title: card.title,
      content: card.content,
      type: card.type,
      imageAlt: card.imageAlt,
      description: card.description,
      slug: card.slug,
      hashtags: card.hashtags,
      likes: card.likes,
      dislikes: card.dislikes,
      globalScore: card.globalScore,
      translations: card.translations,
      projectRankings: card.projectRankings,
      isDeleted: card.isDeleted,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      rank: (page - 1) * limit + index + 1,
      totalVotes: card.likes + card.dislikes
    }));

    return {
      entries,
      total,
      pages,
    };
  }

  /**
   * Retrieves project-specific leaderboard
   * @param projectId ID of the project
   * @param limit Number of entries to return
   * @param page Page number (1-based)
   * @returns Array of leaderboard entries specific to the project
   */
  static async getProjectLeaderboard(
    projectId: string,
    limit: number = 10,
    page: number = 1
  ): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    pages: number;
  }> {
    await dbConnect();

    // Find cards that have rankings for this project
    const query = {
      isDeleted: false,
      'projectRankings.projectId': projectId,
      // readyForVoting check removed - all cards are available for voting
    };

    const total = await Card.countDocuments(query);
    const pages = Math.ceil(total / limit);

    const cards = await Card.aggregate([
      // readyForVoting check removed - all cards are available for voting
      { $match: { isDeleted: false, 'projectRankings.projectId': projectId } },
      { $unwind: '$projectRankings' },
      { $match: { 'projectRankings.projectId': projectId } },
      { $sort: { 'projectRankings.rank': -1, 'projectRankings.votes': -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      { $addFields: { rank: { $add: [{ $multiply: [{ $subtract: [page, 1] }, limit] }, { $add: ['$projectRankings.rank', 1] }] } } }
    ]);

    // Transform to leaderboard entries with project-specific ranking
    const entries: LeaderboardEntry[] = cards.map((card, index) => {
      const projectRanking = card.projectRankings.find(
        (pr: { projectId: string }) => pr.projectId === projectId
      );

      return {
        title: card.title,
        content: card.content,
        type: card.type,
        imageAlt: card.imageAlt,
        description: card.description,
        slug: card.slug,
        hashtags: card.hashtags,
        likes: card.likes,
        dislikes: card.dislikes,
        globalScore: card.globalScore,
        translations: card.translations,
        projectRankings: card.projectRankings,
        isDeleted: card.isDeleted,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
        rank: (page - 1) * limit + index + 1,
        totalVotes: projectRanking?.votes || 0,
        projectRank: projectRanking?.rank || 0
      };
    });

    return {
      entries,
      total,
      pages,
    };
  }

  /**
   * Gets personal rankings for a session
   * @param sessionId Current user's session ID
   * @param projectId Optional project ID to filter by
   * @param limit Number of entries to return
   * @param page Page number (1-based)
   * @returns Array of personally ranked cards
   */
  static async getPersonalRankings(
    sessionId: string,
    projectId?: string,
    limit: number = 10,
    page: number = 1
  ): Promise<{
    entries: LeaderboardEntry[];
    total: number;
    pages: number;
  }> {
    await dbConnect();

    // Find the personal ranking document
    const query: { sessionId: string; projectId?: string } = { sessionId };
    if (projectId) {
      query.projectId = projectId;
    }

    const personalRanking = await PersonalRanking.findOne(query)
      .populate('rankings.cardId')
      .lean() as (IPersonalRanking & { _id: string });

    if (!personalRanking) {
      return {
        entries: [],
        total: 0,
        pages: 0,
      };
    }

    // Sort rankings by rank
    const sortedRankings = personalRanking.rankings
      .sort((a, b) => b.rank - a.rank)
      .slice((page - 1) * limit, page * limit);

    const total = personalRanking.rankings.length;
    const pages = Math.ceil(total / limit);

    // Transform to leaderboard entries
    const entries = await Promise.all(
      sortedRankings.map(async (ranking, index) => {
        const card = await Card.findById(ranking.cardId).lean() as (ICard & { _id: string });
        if (!card) return null;

        return {
          title: card.title,
          content: card.content,
          type: card.type,
          imageAlt: card.imageAlt,
          description: card.description,
          slug: card.slug,
          hashtags: card.hashtags,
          likes: card.likes,
          dislikes: card.dislikes,
          globalScore: card.globalScore,
          translations: card.translations,
          projectRankings: card.projectRankings,
          isDeleted: card.isDeleted,
          createdAt: card.createdAt,
          updatedAt: card.updatedAt,
          rank: (page - 1) * limit + index + 1,
          totalVotes: card.likes + card.dislikes,
          personalRank: ranking.rank
        };
      })
    );

    return {
      entries: entries.filter(Boolean) as LeaderboardEntry[],
      total,
      pages,
    };
  }
}
