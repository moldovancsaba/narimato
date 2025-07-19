import { getMongoDb } from '@/lib/mongodb';

/**
 * Checks if a slug is unique within the specified collection and context
 * @param slug The slug to check
 * @param collection The MongoDB collection name ('cards' or 'projects')
 * @param currentId Optional ID to exclude from the check (for updates)
 * @returns A promise that resolves to true if the slug is unique
 */
export async function isSlugUnique(
  slug: string,
  collection: 'cards' | 'projects',
  currentId?: string
): Promise<boolean> {
  const db = await getMongoDb();
  
  const query = {
    slug,
    ...(currentId ? { _id: { $ne: currentId } } : {}),
    isDeleted: { $ne: true }
  };

  const count = await db.collection(collection).countDocuments(query);
  return count === 0;
}

/**
 * Ensures a slug is unique by appending a number if necessary
 * @param baseSlug The initial slug to make unique
 * @param collection The MongoDB collection name ('cards' or 'projects')
 * @param currentId Optional ID to exclude from the check (for updates)
 * @returns A promise that resolves to a unique slug
 */
export async function ensureUniqueSlug(
  baseSlug: string,
  collection: 'cards' | 'projects',
  currentId?: string
): Promise<string> {
  let slug = baseSlug;
  let counter = 1;

  while (!(await isSlugUnique(slug, collection, currentId))) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }

  return slug;
}
