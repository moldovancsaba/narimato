// Custom session type definition
export interface User {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
}

export interface Session {
  user: User | null;
}

export interface JWT {
  sub?: string;
  user?: User;
}
