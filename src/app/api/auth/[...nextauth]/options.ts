

import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'credentials',
      name: 'Credentials',
      credentials: {
        identifier: { label: 'Email or Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(
        credentials: Record<"identifier" | "password", string> | undefined
      ): Promise<{ id: string; username: string; email: string; role?: string } | null> {
        if (!credentials) {
          throw new Error('No credentials provided');
        }

        await dbConnect();

        const user = await UserModel.findOne({
          $or: [
            { email: credentials.identifier },
            { username: credentials.identifier },
          ],
        });

        if (!user) throw new Error('No user found');

        const isPasswordCorrect = await bcrypt.compare(
          credentials.password,
          user.password
        );

        if (!isPasswordCorrect) throw new Error('Incorrect password');

        // ✅ Must return a plain object with the fields you want in token
        const resultUser = {
          id: (user._id as { toString: () => string }).toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        };
        // Debug log on server to verify role is present when authorizing
        console.log('nextauth authorize returning user:', resultUser);
        return resultUser;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      // ✅ Set data from user into token only once (on login)
      if (user) {
        token.id = user.id;
        token.username = user.username;
        if ((user as any).role) token.role = (user as any).role;
        console.log('nextauth jwt set token from user:', { id: user.id, username: user.username, role: (user as any).role });
      }
      return token;
    },

    async session({ session, token }) {
      // ✅ Put token data into session.user
      if (session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
        session.user.isVerified = token.isVerified as boolean;
        session.user.isAcceptingMessages = token.isAcceptingMessages as boolean;
        // include role from token if available
        session.user.role = token.role as string | undefined;
        // If role is not present in the token (e.g. older tokens), try to read it from DB
        if (!session.user.role && token.id) {
          try {
            await dbConnect();
            const dbUser = await UserModel.findById(token.id).lean();
            if (dbUser && (dbUser as any).role) {
              session.user.role = (dbUser as any).role;
              console.log('nextauth session callback: filled missing role from DB for user', token.id, session.user.role);
            }
          } catch (err) {
            console.error('nextauth session callback: error fetching user from DB to fill role', err);
          }
        }
      }
      // Debug log on server to inspect token -> session mapping
      console.log('nextauth session callback token:', token, 'session.user:', session.user);
      return session;
    },
  },

  session: {
    strategy: 'jwt',
  },

  secret: process.env.NEXTAUTH_SECRET,

  pages: {
    signIn: '/sign-in',
  },
};
