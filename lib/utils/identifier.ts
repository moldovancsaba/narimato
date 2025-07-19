/**
 * Checks if a string is an MD5 hash
 */
export function isMD5Hash(str: string): boolean {
  return /^[a-f0-9]{32}$/i.test(str);
}

/**
 * Gets the proper identifier based on the input
 * If it's an MD5 hash, use it as is
 * If it's a slug, find the card and get its MD5
 */
export function getIdentifierType(str: string): 'md5' | 'slug' {
  return isMD5Hash(str) ? 'md5' : 'slug';
}
