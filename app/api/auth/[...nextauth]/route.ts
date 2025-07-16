import NextAuth, { NextAuthOptions } from 'next-auth';
import { getServerSession } from 'next-auth/next';
import { NextResponse } from 'next/server';
import GoogleProvider from 'next-auth/providers/google';
import { connectToDB } from '@/lib/mongoose';
import { User } from '@/models/User';

// Define NextAuth configuration options
export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session
      if (session.user && token.sub) {
        session.user.id = token.sub;
        return session;
      }
      throw new Error('Invalid session state: user ID is required');
    },
    async signIn({ user, account, profile }) {
      try {
        await connectToDB();

        // Check if user exists
        const existingUser = await User.findOne({ email: user.email });

        if (!existingUser) {
          // Create new user if doesn't exist
          await User.create({
            email: user.email,
            name: user.name,
            image: user.image,
            provider: account?.provider,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        return true;
      } catch (error) {
        console.error('Sign in error:', error);
        return false;
      }
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
};

// Helper function to get server session
export const getAuthSession = () => getServerSession(authOptions);

// Handle NextAuth API routes
const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
