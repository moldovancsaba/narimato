import { headers } from 'next/headers';
import { getServerSession } from 'next-auth';

/**
 * Validates and secures server actions
 * @param action The server action function to secure
 * @returns The secured server action function
 */
export function secureServerAction<T>(
  action: () => Promise<T>,
  options: {
    requireAuth?: boolean;
    rateLimit?: boolean;
    validateOrigin?: boolean;
  } = {}
): Promise<T> {
  const { requireAuth = true, rateLimit = true, validateOrigin = true } = options;

  return new Promise(async (resolve, reject) => {
    try {
      // Authentication check
      if (requireAuth) {
        const session = await getServerSession();
        if (!session) {
          throw new Error('Authentication required');
        }
      }

      // Origin validation
      if (validateOrigin) {
        const headersList = headers();
        const origin = headersList.get('origin');
        const allowedOrigins = ['https://narimato.com', 'https://narimato-34lbix5b5-narimato.vercel.app'];
        
        if (origin && !allowedOrigins.includes(origin)) {
          throw new Error('Invalid origin');
        }
      }

      // Execute the action
      const result = await action();
      resolve(result);
    } catch (error) {
      console.error('Server Action Error:', error);
      reject(error);
    }
  });
}

/**
 * Validates input data for server actions
 * @param data The input data to validate
 * @param schema The validation schema
 * @returns Validated data
 */
export function validateActionInput<T>(data: unknown, schema: any): T {
  try {
    return schema.parse(data) as T;
  } catch (error) {
    console.error('Validation Error:', error);
    throw new Error('Invalid input data');
  }
}
