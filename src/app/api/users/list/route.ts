import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';

export async function GET() {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only agents can list users
    if (session.user.role !== 'Agent') {
      return NextResponse.json({ ok: false, error: 'Forbidden. Only agents can list users.' }, { status: 403 });
    }

    // Fetch all users with role 'User' (exclude agents and sensitive data)
    const users = await UserModel.find(
      { role: 'User' },
      { password: 0, myRegisterAccount: 0 } // Exclude sensitive fields
    ).lean();

    // Transform ObjectIds to strings
    const transformedUsers = users.map(user => ({
      ...user,
      _id: user._id.toString(),
    }));

    return NextResponse.json({ ok: true, users: transformedUsers });
  } catch (err) {
    console.error('GET /api/users/list error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
