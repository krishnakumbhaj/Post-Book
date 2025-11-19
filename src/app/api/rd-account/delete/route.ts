import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import RDAccountModel from '@/models/IRDAccount';
import UserModel from '@/models/User';
import mongoose from 'mongoose';

export async function DELETE(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return NextResponse.json({ ok: false, error: 'Account ID is required' }, { status: 400 });
    }

    // Check if account exists and belongs to user
    const existingAccount = await RDAccountModel.findOne({ _id: id, user: userId });
    if (!existingAccount) {
      return NextResponse.json({ ok: false, error: 'Account not found or access denied' }, { status: 404 });
    }

    // Use transaction to ensure atomic deletion
    const mSession = await mongoose.startSession();
    try {
      await mSession.withTransaction(async () => {
        // Delete RD account
        await RDAccountModel.deleteOne({ _id: id }, { session: mSession });

        // Remove from user's myRegisterAccount array
        await UserModel.updateOne(
          { _id: userId },
          { $pull: { myRegisterAccount: id } },
          { session: mSession }
        );
      });

      return NextResponse.json({ ok: true, message: 'Account deleted successfully' });
    } catch (txErr: any) {
      console.error('Transaction error during delete:', txErr);
      return NextResponse.json({ ok: false, error: 'Failed to delete account' }, { status: 500 });
    } finally {
      await mSession.endSession();
    }
  } catch (err) {
    console.error('DELETE /api/rd-account/delete error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
