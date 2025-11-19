// API route to revert a committed payment session
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import PaymentSessionModel from '@/models/PaymentSession';
import PaymentRecordModel from '@/models/PaymentRecord';
import RDAccountModel from '@/models/IRDAccount';
import mongoose from 'mongoose';
import dayjs from 'dayjs';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = session.user.id;

  try {
    const params = await context.params;
    const sessionId = params.id;

    const paymentSession = await PaymentSessionModel.findById(sessionId);

    if (!paymentSession) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (paymentSession.agent.toString() !== agentId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Check if session is committed
    if (paymentSession.status !== 'committed') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Only committed sessions can be reverted' 
      }, { status: 400 });
    }

    // Check revert window
    if (!paymentSession.allowRevertUntil) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No revert window defined for this session' 
      }, { status: 400 });
    }

    const now = new Date();
    if (now > paymentSession.allowRevertUntil) {
      return NextResponse.json({ 
        ok: false, 
        error: 'Revert window has expired (7 days from commit)',
        allowRevertUntil: paymentSession.allowRevertUntil.toISOString()
      }, { status: 403 });
    }

    // Fetch original payment records
    const originalRecords = await PaymentRecordModel.find({ 
      batchId: paymentSession._id,
      reversed: { $ne: true }
    }).lean();

    if (originalRecords.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No payment records found to revert' 
      }, { status: 404 });
    }

    // Start transaction to revert
    const mSession = await mongoose.startSession();
    const revertedAccounts: any[] = [];
    const reversalRecords: any[] = [];

    try {
      await mSession.withTransaction(async () => {
        const revertDate = new Date();

        for (const record of originalRecords) {
          // Re-fetch account inside transaction
          const account = await RDAccountModel.findOne({ 
            _id: record.account,
            user: paymentSession.user
          }).session(mSession);

          if (!account) {
            throw new Error(`Account ${record.account} not found`);
          }

          // Capture before snapshot (current state)
          const before = {
            monthPaidUpTo: account.monthPaidUpTo,
            totalDepositAmount: account.totalDepositAmount,
            nextInstallmentDueDate: account.nextInstallmentDueDate,
            lastDepositDate: account.lastDepositDate
          };

          // Revert changes (subtract installments and amounts)
          // const denomination = parseFloat(account.denomination.toString());
          const newMonthPaidUpTo = account.monthPaidUpTo - record.installments;
          const newTotalDeposit = parseFloat(account.totalDepositAmount.toString()) - parseFloat(record.amount.toString());

          // Prevent negative values
          if (newMonthPaidUpTo < 0 || newTotalDeposit < 0) {
            throw new Error(`Reverting would produce negative values for account ${account.accountNo}`);
          }

          // Calculate reverted next installment date (subtract months)
          const newNextInstallmentDueDate = dayjs(account.nextInstallmentDueDate)
            .subtract(record.installments, 'month')
            .toDate();

          // Update account
          account.monthPaidUpTo = newMonthPaidUpTo;
          account.totalDepositAmount = mongoose.Types.Decimal128.fromString(newTotalDeposit.toString());
          account.nextInstallmentDueDate = newNextInstallmentDueDate;
          // Restore previous lastDepositDate from the before snapshot
          account.lastDepositDate = record.before.lastDepositDate || undefined;

          await account.save({ session: mSession });

          // Capture after snapshot
          const after = {
            monthPaidUpTo: account.monthPaidUpTo,
            totalDepositAmount: account.totalDepositAmount,
            nextInstallmentDueDate: account.nextInstallmentDueDate,
            lastDepositDate: account.lastDepositDate
          };

          // Mark original record as reversed
          await PaymentRecordModel.updateOne(
            { _id: record._id },
            { $set: { reversed: true } },
            { session: mSession }
          );

          // Create reversal payment record
          const reversalRecord = new PaymentRecordModel({
            batchId: paymentSession._id,
            agent: paymentSession.agent,
            user: paymentSession.user,
            account: account._id,
            installments: -record.installments, // negative to indicate reversal
            denomination: account.denomination,
            amount: mongoose.Types.Decimal128.fromString((-parseFloat(record.amount.toString())).toString()),
            before,
            after,
            paymentMethod: record.paymentMethod,
            reversed: false,
            reversalOf: record._id,
            paymentDate: revertDate
          });

          await reversalRecord.save({ session: mSession });

          revertedAccounts.push(account.toObject());
          reversalRecords.push(reversalRecord.toObject());
        }

        // Update session to prevent further reverts
        paymentSession.allowRevertUntil = undefined;
        await paymentSession.save({ session: mSession });
      });

      await mSession.endSession();

      return NextResponse.json({
        ok: true,
        message: 'Payment session reverted successfully',
        revertedAccounts: revertedAccounts.map(transformAccount),
        reversalRecords: reversalRecords.map(transformRecord)
      });

    } catch (txError: any) {
      await mSession.endSession();
      console.error('Transaction error during revert:', txError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to revert session',
        details: txError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('POST /api/rd-account/payment-session/[id]/revert error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to revert session',
      details: error.message
    }, { status: 500 });
  }
}

function transformAccount(doc: any) {
  const obj = { ...doc };
  if (obj._id?.toString) obj._id = obj._id.toString();
  if (obj.user?.toString) obj.user = obj.user.toString();
  if (obj.denomination?.toString) obj.denomination = obj.denomination.toString();
  if (obj.totalDepositAmount?.toString) obj.totalDepositAmount = obj.totalDepositAmount.toString();
  if (obj.openingDate) obj.openingDate = new Date(obj.openingDate as any).toISOString();
  if (obj.nextInstallmentDueDate) obj.nextInstallmentDueDate = new Date(obj.nextInstallmentDueDate as any).toISOString();
  if (obj.lastDepositDate) obj.lastDepositDate = new Date(obj.lastDepositDate as any).toISOString();
  if (obj.createdAt) obj.createdAt = new Date(obj.createdAt as any).toISOString();
  if (obj.updatedAt) obj.updatedAt = new Date(obj.updatedAt as any).toISOString();
  return obj;
}

function transformRecord(doc: any) {
  const obj = { ...doc };
  if (obj._id?.toString) obj._id = obj._id.toString();
  if (obj.batchId?.toString) obj.batchId = obj.batchId.toString();
  if (obj.agent?.toString) obj.agent = obj.agent.toString();
  if (obj.user?.toString) obj.user = obj.user.toString();
  if (obj.account?.toString) obj.account = obj.account.toString();
  if (obj.denomination?.toString) obj.denomination = obj.denomination.toString();
  if (obj.amount?.toString) obj.amount = obj.amount.toString();
  if (obj.reversalOf?.toString) obj.reversalOf = obj.reversalOf.toString();
  
  if (obj.before) {
    if (obj.before.totalDepositAmount?.toString) obj.before.totalDepositAmount = obj.before.totalDepositAmount.toString();
    if (obj.before.nextInstallmentDueDate) obj.before.nextInstallmentDueDate = new Date(obj.before.nextInstallmentDueDate as any).toISOString();
    if (obj.before.lastDepositDate) obj.before.lastDepositDate = new Date(obj.before.lastDepositDate as any).toISOString();
  }
  
  if (obj.after) {
    if (obj.after.totalDepositAmount?.toString) obj.after.totalDepositAmount = obj.after.totalDepositAmount.toString();
    if (obj.after.nextInstallmentDueDate) obj.after.nextInstallmentDueDate = new Date(obj.after.nextInstallmentDueDate as any).toISOString();
    if (obj.after.lastDepositDate) obj.after.lastDepositDate = new Date(obj.after.lastDepositDate as any).toISOString();
  }
  
  if (obj.paymentDate) obj.paymentDate = new Date(obj.paymentDate as any).toISOString();
  if (obj.createdAt) obj.createdAt = new Date(obj.createdAt as any).toISOString();
  if (obj.updatedAt) obj.updatedAt = new Date(obj.updatedAt as any).toISOString();
  return obj;
}
