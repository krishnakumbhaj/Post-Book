import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';
import { authOptions } from '../../auth/[...nextauth]/options';

export async function GET() {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    console.log('DEBUG /api/debug/me session:', session);

    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: 'No session' }, { status: 401 });
    }

    // Try to fetch the DB user by id first, then fallback to email
    let user = null;
    const userId = session.user.id as string | undefined;
    const email = session.user.email as string | undefined;

    if (userId) {
      user = await UserModel.findById(userId).lean();
    }

    if (!user && email) {
      user = await UserModel.findOne({ email }).lean();
    }

    console.log('DEBUG /api/debug/me db user:', user);

    return NextResponse.json({ ok: true, session, user });
  } catch (err) {
    console.error('DEBUG /api/debug/me error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
