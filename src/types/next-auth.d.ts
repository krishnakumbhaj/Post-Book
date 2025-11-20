import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id?: string;
      _id?: string;
      isVerified?: boolean;
      isAcceptingMessages?: boolean;
      username?: string;
      role?: 'Agent' | 'User' | string;
    } & DefaultSession['user'];
  }

  interface User {
    id?: string;
    _id?: string;
    isVerified?: boolean;
    isAcceptingMessages?: boolean;
    username?: string;
    role?: 'Agent' | 'User' | string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    _id?: string;
    isVerified?: boolean;
    isAcceptingMessages?: boolean;
    username?: string;
    role?: 'Agent' | 'User' | string;
  }
}