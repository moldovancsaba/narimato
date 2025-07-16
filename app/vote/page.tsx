import dbConnect from '@/lib/mongodb';
import { Card as CardModel } from '@/models/Card';
import { VoteSystem } from '@/components/ui/VoteSystem';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';

async function getRandomCards(count: number = 10) {
  try {
    await dbConnect();
    console.log('Fetching random cards...');
    
    // Make sure we have cards in the database
    const cardCount = await CardModel.countDocuments({ isDeleted: false });
    console.log(`Found ${cardCount} cards in total`);
    
    if (cardCount === 0) {
      console.log('No cards found in database');
      return [];
    }
    
    const cards = await CardModel
      .aggregate([
        { $match: { isDeleted: false } },
        { $sample: { size: Math.min(count, cardCount) } },
      ]);
    
    console.log(`Successfully fetched ${cards.length} random cards`);

const mappedCards = cards
      .map(card => {
        if (!card || !card._id) {
          console.log('Invalid card found:', card);
          return null;
        }
        return ({
          id: card._id.toString(),
          content: card.content,
          title: card.title,
          description: card.description,
          type: card.type as 'image' | 'text',
          hashtags: card.hashtags || [],
          imageAlt: card.imageAlt,
          slug: card.slug,
          createdAt: card.createdAt ? card.createdAt.toISOString() : new Date().toISOString(),
          updatedAt: card.updatedAt ? card.updatedAt.toISOString() : new Date().toISOString(),
        });
      })
      .filter((card): card is NonNullable<typeof card> => card !== null);
    
    console.log(`Mapped ${mappedCards.length} valid cards`);
    return mappedCards;
  } catch (error) {
    console.error('Error fetching random cards:', error);
    return [];
  }
}

export default async function VotePage() {
  const cards = await getRandomCards();
  
  // Ensure we have at least 2 cards for voting
  if (cards.length < 2) {
    return (
      <main className="min-h-screen p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-2xl font-bold">Vote on Cards</h1>
          </div>
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              Not enough cards available for voting. Please try again later.
            </p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Vote on Cards</h1>
        </div>

      <ErrorBoundary>
        {cards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No cards available for voting at this time.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Choose your favorite between each pair of cards. Click the buttons below or use keyboard arrows to vote.
            </p>

            <VoteSystem cards={cards} />
          </>
        )}
      </ErrorBoundary>
      </div>
    </main>
  );
}
