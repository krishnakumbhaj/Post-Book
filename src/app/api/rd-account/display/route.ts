import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import UserModel from '@/models/User';
// Ensure RDAccount model schema is registered before populating
import RDAccountModel from '@/models/IRDAccount';

export async function GET(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    console.debug('GET /api/rd-account/display - session userId:', userId);
    console.debug('UserModel registered:', typeof UserModel === 'function');
    console.debug('RDAccountModel registered:', typeof RDAccountModel === 'function');
    const url = new URL(req.url);
    const id = url.searchParams.get('id');

    // Fetch user with populated myRegisterAccount
    let populatedUser: any;
    try {
      populatedUser = await UserModel.findById(userId).populate('myRegisterAccount').lean();
    } catch (fetchErr) {
      console.error('Error during UserModel.findById().populate():', fetchErr);
      // include model info to help debug registration issues
      const modelInfo = {
        UserModelType: typeof UserModel,
        RDAccountModelType: typeof RDAccountModel,
        mongooseModels: Object.keys((await import('mongoose')).models || {}),
      };
      console.error('Model info:', modelInfo);
      return NextResponse.json({ ok: false, error: 'Failed to fetch user', details: String(fetchErr) }, { status: 500 });
    }

    if (!populatedUser) {
      return NextResponse.json({ ok: false, error: 'User not found' }, { status: 404 });
    }

    // Format the populated RD accounts
    let accounts: any[] = [];
    if (Array.isArray(populatedUser.myRegisterAccount)) {
      accounts = populatedUser.myRegisterAccount.map((acc: any) => transform(acc));
    }

    // Handle includeMatured query param (default: true to preserve existing behaviour)
    const includeMaturedParam = url.searchParams.get('includeMatured');
    const includeMatured = includeMaturedParam === null ? true : includeMaturedParam === 'true';
    // Define maturity threshold (months). Accounts with monthPaidUpTo >= MATURITY_MONTHS are considered matured.
    const MATURITY_MONTHS = 60;

    if (!includeMatured) {
      accounts = accounts.filter((a: any) => {
        const months = Number(a.monthPaidUpTo || 0);
        return months < MATURITY_MONTHS;
      });
    }

    // If specific id requested, filter to that account
    if (id) {
      const account = accounts.find((a: any) => a._id === id);
      if (!account) {
        return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true, account });
    }

    return NextResponse.json({ ok: true, accounts });
  } catch (err) {
    console.error('GET /api/rd-account/display error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}

function transform(doc: any) {
  const a = { ...doc } as any;
  if (a._id && typeof a._id.toString === 'function') a._id = a._id.toString();
  if (a.user && typeof a.user.toString === 'function') a.user = a.user.toString();
  if (a.denomination && typeof a.denomination.toString === 'function') a.denomination = a.denomination.toString();
  if (a.totalDepositAmount && typeof a.totalDepositAmount.toString === 'function') a.totalDepositAmount = a.totalDepositAmount.toString();
  if (a.openingDate) a.openingDate = new Date(a.openingDate).toISOString();
  if (a.nextInstallmentDueDate) a.nextInstallmentDueDate = new Date(a.nextInstallmentDueDate).toISOString();
  if (a.lastDepositDate) a.lastDepositDate = new Date(a.lastDepositDate).toISOString();
  if (a.createdAt) a.createdAt = new Date(a.createdAt).toISOString();
  if (a.updatedAt) a.updatedAt = new Date(a.updatedAt).toISOString();
  return a;
}