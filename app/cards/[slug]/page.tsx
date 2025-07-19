import { notFound } from 'next/navigation';
import dbConnect from '@/lib/mongodb';
import { IdentifierService } from '@/lib/services/identifier';
import { CardContainer } from '@/components/ui/CardContainer';

interface CardPageParams {
  params: {
    slug: string;
  };
}

interface CardDocument {
  _id: string;
  type: 'image' | 'text';
  content: string;
  title: string;
  description?: string;
  imageAlt?: string;
  hashtags: string[];
  likes: number;
  dislikes: number;
  globalScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export default async function CardPage({ params }: CardPageParams) {
  await dbConnect();

  // Resolve card by slug or MD5 hash
  const card: CardDocument | null = await IdentifierService.resolveCard(params.slug);

  if (!card) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <CardContainer
          type={card.type}
          content={card.content}
          title={card.title}
          description={card.description}
          imageAlt={card.imageAlt}
          hashtags={card.hashtags}
          createdAt={card.createdAt?.toISOString()}
          updatedAt={card.updatedAt?.toISOString()}
          id={card._id}
          extraContent={
            <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded">
              <h3 className="text-lg font-semibold mb-2">Card Details</h3>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <dt className="text-gray-600">Created</dt>
                <dd>{new Date(card.createdAt).toLocaleString()}</dd>
                <dt className="text-gray-600">Last Updated</dt>
                <dd>{new Date(card.updatedAt).toLocaleString()}</dd>
                <dt className="text-gray-600">Likes</dt>
                <dd>{card.likes || 0}</dd>
                <dt className="text-gray-600">Dislikes</dt>
                <dd>{card.dislikes || 0}</dd>
                <dt className="text-gray-600">Global Score</dt>
                <dd>{card.globalScore || 0}</dd>
              </dl>
            </div>
          }
        />
      </div>
    </div>
  );
}
