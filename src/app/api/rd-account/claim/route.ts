import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';
import RDAccountModel from '@/models/IRDAccount';
import dayjs from 'dayjs';

/**
 * POST /api/rd-account/claim
 * Allows a user to claim/add an existing RD account to their profile
 * by verifying account number and opening date
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
    const { accountNo, openingDate } = body;

    // Validate required fields
    if (!accountNo || !openingDate) {
      return NextResponse.json(
        { ok: false, error: 'Account number and opening date are required' },
        { status: 400 }
      );
    }

    // Find the RD account by account number
    const rdAccount = await RDAccountModel.findOne({ accountNo: accountNo.trim() }).lean();

    if (!rdAccount) {
      return NextResponse.json(
        { ok: false, error: 'No account found with this account number' },
        { status: 404 }
      );
    }

    // Verify the opening date matches (compare in YYYY-MM-DD format)
    const accountOpeningDate = dayjs(rdAccount.openingDate).format('YYYY-MM-DD');
    const providedOpeningDate = dayjs(openingDate).format('YYYY-MM-DD');

    if (accountOpeningDate !== providedOpeningDate) {
      return NextResponse.json(
        { ok: false, error: 'Opening date does not match. Please verify your account details.' },
        { status: 400 }
      );
    }

    // Check if user already has this account in their myRegisterAccount array
    const user = await UserModel.findById(userId).lean();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: 'User not found' },
        { status: 404 }
      );
    }

    const accountIdStr = rdAccount._id.toString();
    const alreadyClaimed = user.myRegisterAccount.some(
      (accId) => accId.toString() === accountIdStr
    );

    if (alreadyClaimed) {
      return NextResponse.json(
        { ok: false, error: 'This account is already added to your profile' },
        { status: 400 }
      );
    }

    // Transform the account data first to ensure no errors
    const transformedAccount = {
      _id: rdAccount._id.toString(),
      accountNo: rdAccount.accountNo,
      accountName: rdAccount.accountName,
      user: rdAccount.user.toString(),
      denomination: rdAccount.denomination?.toString ? rdAccount.denomination.toString() : String(rdAccount.denomination),
      totalDepositAmount: rdAccount.totalDepositAmount?.toString ? rdAccount.totalDepositAmount.toString() : String(rdAccount.totalDepositAmount),
      monthPaidUpTo: rdAccount.monthPaidUpTo,
      openingDate: new Date(rdAccount.openingDate).toISOString(),
      nextInstallmentDueDate: rdAccount.nextInstallmentDueDate ? new Date(rdAccount.nextInstallmentDueDate).toISOString() : undefined,
      lastDepositDate: rdAccount.lastDepositDate ? new Date(rdAccount.lastDepositDate).toISOString() : undefined,
      maturityDate: rdAccount.maturityDate ? new Date(rdAccount.maturityDate).toISOString() : undefined,
    };

    // Only update database after successful transformation
    await UserModel.updateOne(
      { _id: userId },
      { $push: { myRegisterAccount: rdAccount._id } }
    );

    console.log('Account claimed successfully:', {
      accountId: rdAccount._id.toString(),
      userId,
      accountNo: rdAccount.accountNo
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'Account successfully added to your profile',
        account: transformedAccount,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('Error claiming RD account:', error);
    console.error('Error stack:', error.stack);
    console.error('Error message:', error.message);
    return NextResponse.json(
      { ok: false, error: 'Failed to claim account', details: error.message || String(error) },
      { status: 500 }
    );
  }
}
