import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';

/**
 * POST /api/rd-account/remove
 * Removes an RD account from user's myRegisterAccount array
 * Does NOT delete the account from database, just removes the reference
 */
export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const body = await request.json();
    const { accountId } = body;

    if (!accountId) {
      return NextResponse.json(
        { ok: false, error: 'Account ID is required' },
        { status: 400 }
      );
    }

    // Remove the account from user's myRegisterAccount array
    const result = await UserModel.updateOne(
      { _id: userId },
      { $pull: { myRegisterAccount: accountId } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { ok: false, error: 'Account not found in your list' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Account removed from your list successfully',
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error removing RD account:', error);
    return NextResponse.json(
      { ok: false, error: 'Failed to remove account', details: String(error) },
      { status: 500 }
    );
  }
}
