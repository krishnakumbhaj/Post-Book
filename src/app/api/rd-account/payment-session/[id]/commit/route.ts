// API route to commit a payment session
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
    
    // Parse body, but handle empty body gracefully
    let checkInfo;
    try {
      const body = await request.json();
      checkInfo = body.checkInfo;
    } catch {
      // No body or empty body is fine
      checkInfo = undefined;
    }

    const paymentSession = await PaymentSessionModel.findById(sessionId);

    if (!paymentSession) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (paymentSession.agent.toString() !== agentId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Check status
    if (paymentSession.status === 'committed') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Session already committed' 
      }, { status: 400 });
    }

    if (paymentSession.status === 'cancelled') {
      return NextResponse.json({ 
        ok: false, 
        error: 'Session is cancelled' 
      }, { status: 400 });
    }

    // Filter only added items
    const itemsToCommit = paymentSession.items.filter((item: any) => item.added);

    if (itemsToCommit.length === 0) {
      return NextResponse.json({ 
        ok: false, 
        error: 'No items marked as added for commit' 
      }, { status: 400 });
    }

    // Validate business rules
    const totalAmount = itemsToCommit.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.contribution.toString());
    }, 0);

    const paymentMethod = paymentSession.paymentMethod || 'cash';

    // Rule: If cash payment, enforce 20,000 limit (check has no limit)
    if (paymentMethod === 'cash' && totalAmount > 20000) {
      return NextResponse.json({ 
        ok: false, 
        error: `Cash payment total (${totalAmount}) exceeds 20,000 limit` 
      }, { status: 400 });
    }

    // Validate per-account installments <= 12
    for (const item of itemsToCommit) {
      if (item.installments < 0 || item.installments > 12) {
        return NextResponse.json({ 
          ok: false, 
          error: `Invalid installments (${item.installments}) for account ${item.account}` 
        }, { status: 400 });
      }
    }

    // Start transaction
    const mSession = await mongoose.startSession();
    const updatedAccounts: any[] = [];
    const paymentRecords: any[] = [];

    try {
      await mSession.withTransaction(async () => {
        const paymentDate = new Date();

        for (const item of itemsToCommit) {
          if (item.installments === 0) continue;

          // Re-fetch account inside transaction
          const account = await RDAccountModel.findOne({ 
            _id: item.account,
            user: paymentSession.user
          }).session(mSession);

          if (!account) {
            throw new Error(`Account ${item.account} not found`);
          }

          // Capture before snapshot
          const before = {
            monthPaidUpTo: account.monthPaidUpTo,
            totalDepositAmount: account.totalDepositAmount,
            nextInstallmentDueDate: account.nextInstallmentDueDate,
            lastDepositDate: account.lastDepositDate
          };

          // Compute updates
          const denomination = parseFloat(account.denomination.toString());
          const newMonthPaidUpTo = account.monthPaidUpTo + item.installments;
          const newTotalDeposit = parseFloat(account.totalDepositAmount.toString()) + (denomination * item.installments);
          
          // Calculate new next installment date (add months to current nextInstallmentDueDate)
          const baseDate = account.nextInstallmentDueDate || 
                          dayjs(account.openingDate).add(account.monthPaidUpTo, 'month').toDate();
          const newNextInstallmentDueDate = dayjs(baseDate).add(item.installments, 'month').toDate();

          // Update account
          account.monthPaidUpTo = newMonthPaidUpTo;
          account.totalDepositAmount = mongoose.Types.Decimal128.fromString(newTotalDeposit.toString());
          account.nextInstallmentDueDate = newNextInstallmentDueDate;
          account.lastDepositDate = paymentDate;

          await account.save({ session: mSession });

          // Capture after snapshot
          const after = {
            monthPaidUpTo: account.monthPaidUpTo,
            totalDepositAmount: account.totalDepositAmount,
            nextInstallmentDueDate: account.nextInstallmentDueDate,
            lastDepositDate: account.lastDepositDate
          };

          // Create payment record
          const paymentRecord = new PaymentRecordModel({
            batchId: paymentSession._id,
            agent: paymentSession.agent,
            user: paymentSession.user,
            account: account._id,
            installments: item.installments,
            denomination: account.denomination,
            amount: mongoose.Types.Decimal128.fromString((denomination * item.installments).toString()),
            before,
            after,
            paymentMethod,
            checkInfo: paymentMethod === 'check' ? checkInfo : undefined,
            paymentDate
          });

          await paymentRecord.save({ session: mSession });

          updatedAccounts.push(account.toObject());
          paymentRecords.push(paymentRecord.toObject());
        }

        // Update session status
        paymentSession.status = 'committed';
        paymentSession.committedAt = new Date();
        // Set revert window to 7 days from commit
        paymentSession.allowRevertUntil = dayjs().add(7, 'day').toDate();
        if (checkInfo) {
          paymentSession.checkInfo = checkInfo;
        }

        await paymentSession.save({ session: mSession });
      });

      await mSession.endSession();

      return NextResponse.json({
        ok: true,
        message: 'Payment session committed successfully',
        session: transformSession(paymentSession.toObject()),
        updatedAccounts: updatedAccounts.map(transformAccount),
        paymentRecords: paymentRecords.map(transformRecord)
      });

    } catch (txError: any) {
      await mSession.endSession();
      console.error('Transaction error during commit:', txError);
      return NextResponse.json({ 
        ok: false, 
        error: 'Failed to commit session',
        details: txError.message
      }, { status: 500 });
    }

  } catch (error: any) {
    console.error('POST /api/rd-account/payment-session/[id]/commit error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to commit session',
      details: error.message
    }, { status: 500 });
  }
}

function transformSession(doc: any) {
  const obj = { ...doc };
  if (obj._id?.toString) obj._id = obj._id.toString();
  if (obj.agent?.toString) obj.agent = obj.agent.toString();
  if (obj.user?.toString) obj.user = obj.user.toString();
  if (obj.totalAmount?.toString) obj.totalAmount = obj.totalAmount.toString();
  if (obj.items && Array.isArray(obj.items)) obj.items = obj.items.map((item: any) => ({
    account: item.account?.toString ? item.account.toString() : item.account,
    installments: item.installments,
    denomination: item.denomination?.toString ? item.denomination.toString() : item.denomination,
    contribution: item.contribution?.toString ? item.contribution.toString() : item.contribution,
    added: item.added
  }));
  if (obj.committedAt) obj.committedAt = new Date(obj.committedAt as any).toISOString();
  if (obj.allowRevertUntil) obj.allowRevertUntil = new Date(obj.allowRevertUntil as any).toISOString();
  if (obj.createdAt) obj.createdAt = new Date(obj.createdAt as any).toISOString();
  if (obj.updatedAt) obj.updatedAt = new Date(obj.updatedAt as any).toISOString();
  return obj;
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
