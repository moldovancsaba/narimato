// Auth config will be replaced with a new auth implementation

export interface AuthConfig {
  pages: {
    signIn: string;
  };
}

export const authConfig: AuthConfig = {
  pages: {
    signIn: '/auth/login',
  },
};

// Export a temporary placeholder auth function
export const auth = async () => {
  // TODO: Implement new auth logic
  return null;
};
