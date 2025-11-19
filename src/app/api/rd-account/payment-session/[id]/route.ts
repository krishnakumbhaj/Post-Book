import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import dbConnect from '@/lib/dbConnect';
import PaymentSessionModel from '@/models/PaymentSession';
import RDAccountModel from '@/models/IRDAccount';
import mongoose from 'mongoose';

type RouteContext = {
  params: Promise<{ id: string }>;
};

// GET - Get session by ID
export async function GET(request: NextRequest, context: RouteContext) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const sessionId = params.id;

    const paymentSession = await PaymentSessionModel.findById(sessionId).lean();

    if (!paymentSession) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (paymentSession.agent.toString() !== session.user.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      session: transformSession(paymentSession)
    });

  } catch (error: any) {
    console.error('GET /api/rd-account/payment-session/[id] error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to fetch session',
      details: error.message
    }, { status: 500 });
  }
}

// PATCH - Update session (add/remove/modify items)
export async function PATCH(request: NextRequest, context: RouteContext) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  const agentId = session.user.id;

  try {
    const params = await context.params;
    const sessionId = params.id;
    const body = await request.json();
    const { action, items, accountId, installments, paymentMethod } = body;

    const paymentSession = await PaymentSessionModel.findById(sessionId);

    if (!paymentSession) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (paymentSession.agent.toString() !== agentId) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Check if session is still editable
    if (['committed', 'cancelled'].includes(paymentSession.status)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Session is ${paymentSession.status} and cannot be modified` 
      }, { status: 400 });
    }

    // Handle different actions
    if (action === 'setItems' && items && Array.isArray(items)) {
      // Replace all items
      paymentSession.items = [];
      
      for (const item of items) {
        if (!item.accountId || item.installments === undefined) continue;
        
        const account = await RDAccountModel.findOne({ 
          _id: item.accountId, 
          user: paymentSession.user 
        }).lean();

        if (!account) continue;

        const inst = Math.max(0, Math.min(12, item.installments));
        if (inst === 0) continue;

        const denomination = parseFloat(account.denomination.toString());
        const contribution = denomination * inst;

        paymentSession.items.push({
          account: account._id,
          installments: inst,
          denomination: account.denomination,
          contribution: mongoose.Types.Decimal128.fromString(contribution.toString()),
          added: item.added !== undefined ? item.added : false
        });
      }

    } else if (action === 'addItem' && accountId && installments !== undefined) {
      // Add single item
      const account = await RDAccountModel.findOne({ 
        _id: accountId, 
        user: paymentSession.user 
      }).lean();

      if (!account) {
        return NextResponse.json({ ok: false, error: 'Account not found' }, { status: 404 });
      }

      // Check if already exists
      const existingIndex = paymentSession.items.findIndex(
        item => item.account.toString() === accountId
      );

      const inst = Math.max(0, Math.min(12, installments));
      
      if (inst === 0 && existingIndex >= 0) {
        // Remove item
        paymentSession.items.splice(existingIndex, 1);
      } else if (inst > 0) {
        const denomination = parseFloat(account.denomination.toString());
        const contribution = denomination * inst;

        const newItem = {
          account: account._id,
          installments: inst,
          denomination: account.denomination,
          contribution: mongoose.Types.Decimal128.fromString(contribution.toString()),
          added: false
        };

        if (existingIndex >= 0) {
          paymentSession.items[existingIndex] = newItem;
        } else {
          paymentSession.items.push(newItem);
        }
      }

    } else if (action === 'removeItem' && accountId) {
      // Remove item
      paymentSession.items = paymentSession.items.filter(
        item => item.account.toString() !== accountId
      );

    } else if (action === 'toggleAdded' && accountId) {
      // Toggle added flag
      const item = paymentSession.items.find(
        item => item.account.toString() === accountId
      );
      if (item) {
        item.added = !item.added;
        
        // If any item is added, set status to ongoing
        const hasAdded = paymentSession.items.some(i => i.added);
        if (hasAdded && paymentSession.status === 'draft') {
          paymentSession.status = 'ongoing';
        }
      }

    } else if (action === 'markAllAdded') {
      // Mark all items as added
      paymentSession.items.forEach(item => {
        item.added = true;
      });
      if (paymentSession.items.length > 0) {
        paymentSession.status = 'ongoing';
      }

    } else if (action === 'updatePaymentMethod' && paymentMethod) {
      if (['cash', 'check'].includes(paymentMethod)) {
        paymentSession.paymentMethod = paymentMethod;
      }
    }

    // Recompute total
    const total = paymentSession.items.reduce((sum, item) => {
      return sum + parseFloat(item.contribution.toString());
    }, 0);
    paymentSession.totalAmount = mongoose.Types.Decimal128.fromString(total.toString());

    await paymentSession.save();

    return NextResponse.json({
      ok: true,
      session: transformSession(paymentSession.toObject())
    });

  } catch (error: any) {
    console.error('PATCH /api/rd-account/payment-session/[id] error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to update session',
      details: error.message
    }, { status: 500 });
  }
}

// DELETE - Cancel session
export async function DELETE(request: NextRequest, context: RouteContext) {
  await dbConnect();

  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const params = await context.params;
    const sessionId = params.id;

    const paymentSession = await PaymentSessionModel.findById(sessionId);

    if (!paymentSession) {
      return NextResponse.json({ ok: false, error: 'Session not found' }, { status: 404 });
    }

    // Verify ownership
    if (paymentSession.agent.toString() !== session.user.id) {
      return NextResponse.json({ ok: false, error: 'Access denied' }, { status: 403 });
    }

    // Can only cancel draft/ongoing
    if (!['draft', 'ongoing'].includes(paymentSession.status)) {
      return NextResponse.json({ 
        ok: false, 
        error: `Cannot cancel ${paymentSession.status} session` 
      }, { status: 400 });
    }

    paymentSession.status = 'cancelled';
    await paymentSession.save();

    return NextResponse.json({
      ok: true,
      message: 'Session cancelled'
    });

  } catch (error: any) {
    console.error('DELETE /api/rd-account/payment-session/[id] error:', error);
    return NextResponse.json({ 
      ok: false, 
      error: 'Failed to cancel session',
      details: error.message
    }, { status: 500 });
  }
}

function transformSession(doc: any) {
  const session: any = { ...doc };
  if (session._id?.toString) session._id = session._id.toString();
  if (session.agent?.toString) session.agent = session.agent.toString();
  if (session.user?.toString) session.user = session.user.toString();
  if (session.totalAmount?.toString) session.totalAmount = session.totalAmount.toString();
  
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
