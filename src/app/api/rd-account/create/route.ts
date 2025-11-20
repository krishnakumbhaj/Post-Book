import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import RDAccountModel from '@/models/IRDAccount';
import UserModel from '@/models/User';
import mongoose from 'mongoose';

export async function POST(request: NextRequest) {
  await dbConnect();

  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized. Please log in.' },
      { status: 401 }
    );
  }

  const userId = session.user._id || session.user.id;

  // Hoisted transform helper so it can be used in catch blocks above its original usage.
  function transform(obj: any): any {
    if (!obj) return obj;

    if (Array.isArray(obj)) {
      return obj.map(transform);
    }

    if (typeof obj === 'object') {
      const transformed: any = {};
      for (const key in obj) {
        const value = obj[key];
        if (value && typeof value === 'object' && '$numberDecimal' in value) {
          transformed[key] = value.$numberDecimal;
        } else if (value && typeof value === 'object' && value._bsontype === 'Decimal128') {
          transformed[key] = value.toString();
        } else if (value && typeof value === 'object' && value._bsontype === 'ObjectId') {
          transformed[key] = value.toString();
        } else if (value instanceof Date) {
          transformed[key] = value.toISOString();
        } else if (typeof value === 'object' && value !== null) {
          transformed[key] = transform(value);
        } else {
          transformed[key] = value;
        }
      }
      return transformed;
    }

    return obj;
  }

  try {
    const body = await request.json();
    const { 
      accountNo, 
      accountName, 
      openingDate, 
      denomination, 
      monthPaidUpTo, 
      nextInstallmentDueDate, 
      lastDepositDate,
      maturityDate,
      targetUserId // Allow agents to specify which user to create account for
    } = body;

    // Determine which user this account is for
    // If targetUserId is provided (agent creating for user), use that
    // Otherwise use the logged-in user's ID
    const accountOwnerUserId = targetUserId || userId;

    // Validate required fields
    if (!accountNo || !accountName || !openingDate || !denomination || monthPaidUpTo === undefined || !nextInstallmentDueDate || !maturityDate) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!Number.isInteger(monthPaidUpTo) || monthPaidUpTo < 0) {
      return NextResponse.json(
        { ok: false, error: 'monthPaidUpTo must be a non-negative integer' },
        { status: 400 }
      );
    }

    const denominationNum = Number(denomination);
    if (isNaN(denominationNum) || denominationNum <= 0) {
      return NextResponse.json(
        { ok: false, error: 'denomination must be a positive number' },
        { status: 400 }
      );
    }

    const totalDepositAmount = denominationNum * monthPaidUpTo;

    const existingAccount = await RDAccountModel.findOne({ 
      accountNo, 
      user: accountOwnerUserId 
    });

    if (existingAccount) {
      return NextResponse.json(
        { ok: false, error: 'Account number already exists for this user' },
        { status: 409 }
      );
    }

    const mSession = await mongoose.startSession();
    let newAccount: any = null;

    try {
      await mSession.withTransaction(async () => {
        // Create the RD account
        const accounts = await RDAccountModel.create(
          [{
            user: accountOwnerUserId,
            accountNo,
            accountName,
            openingDate: new Date(openingDate),
            denomination: denominationNum.toString(),
            monthPaidUpTo,
            totalDepositAmount: totalDepositAmount.toString(),
            nextInstallmentDueDate: new Date(nextInstallmentDueDate),
            lastDepositDate: lastDepositDate ? new Date(lastDepositDate) : undefined,
            maturityDate: new Date(maturityDate),
          }],
          { session: mSession }
        );
        newAccount = accounts[0];

        // Add account to the target user's myRegisterAccount array
        await UserModel.updateOne(
          { _id: accountOwnerUserId },
          { $push: { myRegisterAccount: newAccount._id } },
          { session: mSession }
        );
      });
    } catch (txError: any) {
      await mSession.endSession();

      // Handle duplicate key error: fetch existing account and return success to client
      if (txError && (txError.code === 11000 || (txError.keyValue && txError.keyValue.accountNo))) {
        try {
          const existing = await RDAccountModel.findOne({ accountNo, user: accountOwnerUserId }).lean();
          const populatedUser = await UserModel.findById(accountOwnerUserId).populate('myRegisterAccount').lean();

          return NextResponse.json(
            {
              ok: true,
              message: 'RD Account already exists',
              account: transform(existing),
              user: populatedUser,
            },
            { status: 200 }
          );
        } catch (fetchErr) {
          console.error('Error fetching existing account after duplicate key:', fetchErr);
          return NextResponse.json({ ok: false, error: 'Account exists but failed to retrieve' }, { status: 500 });
        }
      }

      throw txError;
    }

    await mSession.endSession();

    if (!newAccount) {
      return NextResponse.json(
        { ok: false, error: 'Failed to create account - account is null after transaction' },
        { status: 500 }
      );
    }

    // Fetch the account fresh from DB to ensure it's properly populated
    const createdAccount = await RDAccountModel.findById(newAccount._id).lean();
    const user = await UserModel.findById(accountOwnerUserId)
      .populate('myRegisterAccount')
      .lean();

    const transformedUser = transform(user);
    const transformedAccount = transform(createdAccount);

    console.log('RD Account created successfully:', {
      accountId: newAccount._id,
      accountNo: createdAccount?.accountNo
    });

    return NextResponse.json(
      {
        ok: true,
        message: 'RD Account created successfully',
        account: transformedAccount,
        user: transformedUser,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error creating RD account:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      errors: error.errors
    });
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Failed to create RD account', 
        details: error.message,
        validationErrors: error.errors 
      },
      { status: 500 }
    );
  }
}
