import dbConnect from '@/lib/mongodb';
import { Card as CardModel } from '@/models/Card';
import { VoteSystem } from '@/components/ui/VoteSystem';

async function getRandomCards(count: number = 10) {
  try {
    await dbConnect();
    const cards = await CardModel
      .aggregate([
        { $match: { isDeleted: false } },
        { $sample: { size: count } },
      ]);

return cards.map(card => ({
      id: card._id.toString(),
      content: card.content,
      title: card.title,
      description: card.description,
      type: card.type,
      hashtags: card.hashtags,
      imageAlt: card.imageAlt,
      slug: card.slug,
      createdAt: card.createdAt ? card.createdAt.toISOString() : new Date().toISOString(),
      updatedAt: card.updatedAt ? card.updatedAt.toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('Error fetching random cards:', error);
    return [];
  }
}

export default async function VotePage() {
  const cards = await getRandomCards();

  return (
    <main className="min-h-screen p-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Vote on Cards</h1>
        </div>

        {cards.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600 dark:text-gray-400">
              No cards available for voting at this time.
            </p>
          </div>
        ) : (
          <>
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Choose your favorite between each pair of cards. You can use keyboard arrows or swipe gestures to vote.
            </p>

            <VoteSystem cards={cards} />
          </>
        )}
      </div>
    </main>
  );
}
