import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import RDAccountModel from '@/models/IRDAccount';
import mongoose from 'mongoose';

export async function PUT(req: NextRequest) {
  try {
    await dbConnect();

    const session = await getServerSession(authOptions);
    if (!session || !session.user || !session.user.id) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const userId = session.user.id as string;
    const body = await req.json();

    const {
      id,
      accountNo,
      accountName,
      openingDate,
      denomination,
      monthPaidUpTo,
      nextInstallmentDueDate,
      lastDepositDate,
    } = body;

    // Validate required fields
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Account ID is required' }, { status: 400 });
    }

    // Check if account exists and belongs to user
    const existingAccount = await RDAccountModel.findOne({ _id: id, user: userId });
    if (!existingAccount) {
      return NextResponse.json({ ok: false, error: 'Account not found or access denied' }, { status: 404 });
    }

    // Build update object
    const updateFields: any = {};
    if (accountNo !== undefined) updateFields.accountNo = accountNo;
    if (accountName !== undefined) updateFields.accountName = accountName;
    if (openingDate !== undefined) updateFields.openingDate = new Date(openingDate);
    if (nextInstallmentDueDate !== undefined) updateFields.nextInstallmentDueDate = new Date(nextInstallmentDueDate);
    if (lastDepositDate !== undefined) updateFields.lastDepositDate = lastDepositDate ? new Date(lastDepositDate) : null;

    // Handle denomination
    if (denomination !== undefined) {
      const denomString = String(denomination).replace(/,/g, '').trim();
      if (isNaN(Number(denomString))) {
        return NextResponse.json({ ok: false, error: 'Invalid denomination' }, { status: 400 });
      }
      updateFields.denomination = mongoose.Types.Decimal128.fromString(denomString);
    }

    // Handle monthPaidUpTo
    if (monthPaidUpTo !== undefined) {
      const monthsNum = Number(monthPaidUpTo);
      if (!Number.isInteger(monthsNum) || monthsNum < 0) {
        return NextResponse.json({ ok: false, error: 'monthPaidUpTo must be a non-negative integer' }, { status: 400 });
      }
      updateFields.monthPaidUpTo = monthsNum;
    }

    // Recalculate totalDepositAmount if denomination or monthPaidUpTo changed
    const finalDenom = updateFields.denomination || existingAccount.denomination;
    const finalMonths = updateFields.monthPaidUpTo !== undefined ? updateFields.monthPaidUpTo : existingAccount.monthPaidUpTo;

    const denomFloat = parseFloat(finalDenom.toString());
    const totalFloat = denomFloat * finalMonths;
    updateFields.totalDepositAmount = mongoose.Types.Decimal128.fromString(totalFloat.toString());

    // Update the account
    const updatedAccount = await RDAccountModel.findByIdAndUpdate(
      id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).lean();

    if (!updatedAccount) {
      return NextResponse.json({ ok: false, error: 'Failed to update account' }, { status: 500 });
    }

    // Format response
    const accountObj: any = { ...updatedAccount };
    if (accountObj._id && typeof accountObj._id.toString === 'function') accountObj._id = accountObj._id.toString();
    if (accountObj.user && typeof accountObj.user.toString === 'function') accountObj.user = accountObj.user.toString();
    if (accountObj.denomination && typeof accountObj.denomination.toString === 'function') accountObj.denomination = accountObj.denomination.toString();
    if (accountObj.totalDepositAmount && typeof accountObj.totalDepositAmount.toString === 'function') accountObj.totalDepositAmount = accountObj.totalDepositAmount.toString();
    if (accountObj.openingDate) accountObj.openingDate = new Date(accountObj.openingDate).toISOString();
    if (accountObj.nextInstallmentDueDate) accountObj.nextInstallmentDueDate = new Date(accountObj.nextInstallmentDueDate).toISOString();
    if (accountObj.lastDepositDate) accountObj.lastDepositDate = new Date(accountObj.lastDepositDate).toISOString();

    return NextResponse.json({ ok: true, account: accountObj });
  } catch (err: any) {
    if (err?.code === 11000) {
      return NextResponse.json({ ok: false, error: 'Account number already exists' }, { status: 409 });
    }
    console.error('PUT /api/rd-account/edit error:', err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
