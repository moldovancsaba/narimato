// Placeholder auth helper with default access
export const auth = {
  async getSession() {
    return {
      user: {
        email: 'anonymous@narimato.com',
        role: 'admin'
      }
    };
  },

  async isAuthenticated() {
    return true;
  },

  async isAdmin() {
    return true;
  }
};
