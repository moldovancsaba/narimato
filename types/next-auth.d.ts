import { DefaultSession } from 'next-auth';

export interface User {
  id: string;
  email: string;
  role: string;
}

declare module 'next-auth' {
  interface Session {
    user: User & DefaultSession['user'];
  }
}
