import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import PaymentSessionModel from '@/models/PaymentSession';
import RDAccountModel from '@/models/IRDAccount';
import mongoose from 'mongoose';

// POST - Create or get existing draft session
export async function POST(request: NextRequest) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = session.user.id;
  
  // Verify agent role
  if (session.user.role !== 'Agent') {
    return NextResponse.json({ ok: false, error: 'Only agents can create payment sessions' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { userId, items, paymentMethod } = body;

    if (!userId) {
      return NextResponse.json({ ok: false, error: 'userId is required' }, { status: 400 });
    }

    // Always create a new session (allow multiple ongoing sessions)
    // Create new session
    const newSession = new PaymentSessionModel({
      agent: agentId,
      user: userId,
      items: [],
      totalAmount: mongoose.Types.Decimal128.fromString('0'),
      status: 'draft',
      paymentMethod: paymentMethod || 'cash'
    });

    // If items provided, add them
    if (items && Array.isArray(items) && items.length > 0) {
      for (const item of items) {
        if (!item.accountId || item.installments === undefined) continue;
        
        const account = await RDAccountModel.findOne({ 
          _id: item.accountId, 
          user: userId 
        }).lean();

        if (!account) continue;

        const installments = Math.max(0, Math.min(12, item.installments));
        if (installments === 0) continue;

        const denomination = parseFloat(account.denomination.toString());
        const contribution = denomination * installments;

        newSession.items.push({
          account: account._id,
          installments,
          denomination: account.denomination,
          contribution: mongoose.Types.Decimal128.fromString(contribution.toString()),
          added: false
        });
      }

      // Compute total
      const total = newSession.items.reduce((sum, item) => {
        return sum + parseFloat(item.contribution.toString());
      }, 0);
      newSession.totalAmount = mongoose.Types.Decimal128.fromString(total.toString());
    }

    await newSession.save();

    return NextResponse.json({
      ok: true,
      session: transformSession(newSession.toObject()),
      message: 'Payment session created'
    }, { status: 201 });

  } catch (error) {
    console.error('POST /api/rd-account/payment-session error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to create session',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// GET - List sessions for agent
export async function GET(request: NextRequest) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = session.user.id;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const userId = url.searchParams.get('userId');

    const filter: Record<string, unknown> = { agent: agentId };
    if (status) filter.status = status;
    if (userId) filter.user = userId;

    const sessions = await PaymentSessionModel.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({
      ok: true,
      sessions: sessions.map(transformSession)
    });

  } catch (error) {
    console.error('GET /api/rd-account/payment-session error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to fetch sessions',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function transformSession(doc: any) {
  const session: any = { ...doc };
  if (session._id && typeof session._id === 'object' && 'toString' in session._id) session._id = session._id.toString();
  if (session.agent && typeof session.agent === 'object' && 'toString' in session.agent) session.agent = session.agent.toString();
  if (session.user && typeof session.user === 'object' && 'toString' in session.user) session.user = session.user.toString();
  if (session.totalAmount && typeof session.totalAmount === 'object' && 'toString' in session.totalAmount) session.totalAmount = session.totalAmount.toString();
  
  if (session.items && Array.isArray(session.items)) {
    session.items = session.items.map((item: any) => ({
      account: item.account?.toString ? item.account.toString() : item.account,
      installments: item.installments,
      denomination: item.denomination?.toString ? item.denomination.toString() : item.denomination,
      contribution: item.contribution?.toString ? item.contribution.toString() : item.contribution,
      added: item.added
    }));
  }

  if (session.committedAt) session.committedAt = new Date(session.committedAt).toISOString();
  if (session.allowRevertUntil) session.allowRevertUntil = new Date(session.allowRevertUntil).toISOString();
  if (session.createdAt) session.createdAt = new Date(session.createdAt).toISOString();
  if (session.updatedAt) session.updatedAt = new Date(session.updatedAt).toISOString();

  return session;
}
