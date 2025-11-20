'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, Plus, Minus, PackagePlus, X, Check, ArrowLeft, Calendar } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';
import CircularLoader from '@/components/CircularLoader';
import { ConfirmationDialog } from '@/components/ConfirmationDialog';

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
  denomination: string;
  totalDepositAmount: string;
  monthPaidUpTo: number;
  nextInstallmentDueDate: string;
  lastDepositDate?: string;
  openingDate: string;
}

interface SessionItem {
  account: string;
  installments: number;
  denomination: string;
  contribution: string;
  added: boolean;
}

interface PaymentSession {
  _id: string;
  agent: string;
  user: string;
  items: SessionItem[];
  totalAmount: string;
  status: string;
  paymentMethod: 'cash' | 'check';
}

export default function ReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<RDAccount[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [currentSession, setCurrentSession] = useState<PaymentSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCart, setShowCart] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'check'>('cash');
  // Denomination single-handle slider (>= selected value, 500 step increments)
  const [denomValue, setDenomValue] = useState<number>(500);
  const [sortByDueDate, setSortByDueDate] = useState<'none' | 'asc' | 'desc'>('none');
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [itemToRemove, setItemToRemove] = useState<{ accountId: string; accountNo: string } | null>(null);

  // Load user's RD accounts
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'Agent') {
      loadAccounts();
    } else if (status === 'authenticated' && session?.user?.role !== 'Agent') {
      toast({
        title: 'Access Denied',
        description: 'Only agents can create reports',
        variant: 'destructive',
      });
      router.push('/Home');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  // Refresh data when the window/tab regains focus or becomes visible again
  useEffect(() => {
    const reloadIfNeeded = () => {
      if (status === 'authenticated' && session?.user?.role === 'Agent') {
        loadAccounts();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') reloadIfNeeded();
    };

    window.addEventListener('focus', reloadIfNeeded);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      window.removeEventListener('focus', reloadIfNeeded);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      // For demo, we'll assume the agent is working with their own accounts
      // In production, you'd have a way to select which user's accounts to work with
      // For reports we exclude matured accounts (monthPaidUpTo >= 60)
      const response = await axios.get('/api/rd-account/display?includeMatured=false');
      if (response.data.ok) {
        setAccounts(response.data.accounts || []);
        if (response.data.accounts && response.data.accounts.length > 0) {
          // Auto-set user ID from first account
          const userId = response.data.accounts[0].user || session?.user?.id;
          setSelectedUserId(userId);
          // Auto-create or get session
          await loadOrCreateSession(userId);
        }
      }
    } catch (error) {
      console.error('Error loading accounts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load accounts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const loadOrCreateSession = async (userId: string, opts?: { forceNew?: boolean }) => {
    try {
      // If caller requests a fresh session, create it regardless of existing ongoing/draft
      if (opts?.forceNew) {
        const response = await axios.post('/api/rd-account/payment-session', {
          userId,
          paymentMethod,
        });

        if (response.data.ok) {
          setCurrentSession(response.data.session);
        }
        return;
      }

      // Try to find an existing ongoing or draft session WITHOUT any added items
      const ongoingResp = await axios.get(`/api/rd-account/payment-session?status=ongoing&userId=${userId}`);
      if (ongoingResp.data?.ok && ongoingResp.data.sessions && ongoingResp.data.sessions.length > 0) {
        // Find a session that has no added items
        const availableSession = ongoingResp.data.sessions.find((s: PaymentSession) => 
          !s.items.some(item => item.added)
        );
        if (availableSession) {
          setCurrentSession(availableSession);
          return;
        }
      }

      const draftResp = await axios.get(`/api/rd-account/payment-session?status=draft&userId=${userId}`);
      if (draftResp.data?.ok && draftResp.data.sessions && draftResp.data.sessions.length > 0) {
        // Find a session that has no added items
        const availableSession = draftResp.data.sessions.find((s: PaymentSession) => 
          !s.items.some(item => item.added)
        );
        if (availableSession) {
          setCurrentSession(availableSession);
          return;
        }
      }

      // No existing usable session -> create a new one
      const response = await axios.post('/api/rd-account/payment-session', {
        userId,
        paymentMethod,
      });

      if (response.data.ok) {
        setCurrentSession(response.data.session);
      }
    } catch (error: any) {
      console.error('Error loading session:', error);
      toast({
        title: 'Error',
        description: 'Failed to create payment session',
        variant: 'destructive',
      });
    }
  };

  const handleAddAccount = async (account: RDAccount) => {
    if (!currentSession) {
      toast({
        title: 'Error',
        description: 'No active session',
        variant: 'destructive',
      });
      return;
    }

    // Check if account is already in session
    const existingItem = currentSession.items.find(item => item.account === account._id);

    if (existingItem) {
      // Remove from session
      await removeFromCart(account._id);
      return;
    }

    // Add account to session with 1 installment
    try {
      const response = await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
        action: 'addItem',
        accountId: account._id,
        installments: 1,
      });

      if (response.data.ok) {
        setCurrentSession(response.data.session);
        toast({
          title: 'Account Added',
          description: `${account.accountName} added with 1 installment`,
        });
      }
    } catch (error: any) {
      console.error('Error adding account:', error);
      toast({
        title: 'Error',
        description: error?.response?.data?.error || 'Failed to add account',
        variant: 'destructive',
      });
    }
  };

  const updateInstallments = async (accountId: string, delta: number) => {
    if (!currentSession) return;

    const item = currentSession.items.find(i => i.account === accountId);
    if (!item) return;

    const newInstallments = Math.max(0, Math.min(12, item.installments + delta));

    try {
      const response = await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
        action: 'addItem',
        accountId,
        installments: newInstallments,
      });

      if (response.data.ok) {
        setCurrentSession(response.data.session);
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to update installments',
        variant: 'destructive',
      });
    }
  };

  const removeFromCart = (accountId: string, accountNo: string) => {
    setItemToRemove({ accountId, accountNo });
    setConfirmDialogOpen(true);
  };

  const confirmRemoveFromCart = async () => {
    if (!currentSession || !itemToRemove) return;

    try {
      const response = await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
        action: 'removeItem',
        accountId: itemToRemove.accountId,
      });

      if (response.data.ok) {
        setCurrentSession(response.data.session);
        toast({
          title: 'Removed',
          description: 'Account removed from cart',
        });
      }
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to remove account',
        variant: 'destructive',
      });
    } finally {
      setItemToRemove(null);
    }
  };

  const handleAddToConfirmReport = async () => {
    if (!currentSession || currentSession.items.length === 0) {
      toast({
        title: 'Error',
        description: 'No accounts selected',
        variant: 'destructive',
      });
      return;
    }

    // Calculate total
    const total = currentSession.items.reduce((sum, item) => {
      return sum + parseFloat(item.contribution);
    }, 0);

    // Validate cash limit
    if (paymentMethod === 'cash' && total > 20000) {
      toast({
        title: 'Limit Exceeded',
        description: `Cash payment total (₹${total.toFixed(2)}) exceeds ₹20,000 limit. Please use check payment or reduce installments.`,
        variant: 'destructive',
      });
      return;
    }

    try {
      // Mark all items as added
      const response = await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
        action: 'markAllAdded',
      });

      if (response.data.ok) {
        const committedSession = response.data.session;
        toast({
          title: 'Success',
          description: 'Report added to confirmation queue',
        });

        // Create a fresh session for the next report
        await loadOrCreateSession(selectedUserId, { forceNew: true });

        // Redirect to confirm page and pass the committed session id so it is highlighted
        router.push(`/rd-account/confirm-report?sessionId=${committedSession._id}`);
      }
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Failed to add to confirm report';
      toast({
        title: 'Error',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleCancelCart = async () => {
    if (!currentSession) return;

    try {
      // Remove all items (set to 0 installments)
      await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
        action: 'setItems',
        items: [],
      });

      setCurrentSession({ ...currentSession, items: [] });
      setShowCart(false);
      toast({
        title: 'Cancelled',
        description: 'Cart cleared',
      });
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to cancel',
        variant: 'destructive',
      });
    }
  };

  const handlePaymentMethodChange = async (method: 'cash' | 'check') => {
    setPaymentMethod(method);

    if (currentSession) {
      try {
        await axios.patch(`/api/rd-account/payment-session/${currentSession._id}`, {
          action: 'updatePaymentMethod',
          paymentMethod: method,
        });
        setCurrentSession({ ...currentSession, paymentMethod: method });
      } catch {
        console.error('Error updating payment method');
      }
    }
  };

  const filteredAccounts = accounts.filter(account =>
    (account.accountName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.accountNo.includes(searchQuery)) &&
    // filter by selected denomination (>= denomValue)
    Number(account.denomination) >= denomValue
  );

  const cartTotal = currentSession?.items.reduce((sum, item) => {
    return sum + parseFloat(item.contribution);
  }, 0) || 0;

  // Number of items in the cart
  const cartCount = currentSession?.items.length || 0;

  // Separate selected and non-selected accounts (after filtering)
  let selectedAccounts = filteredAccounts.filter(account =>
    currentSession?.items.find(item => item.account === account._id)
  );
  let nonSelectedAccounts = filteredAccounts.filter(account =>
    !currentSession?.items.find(item => item.account === account._id)
  );

  // Optionally sort by nextInstallmentDueDate
  if (sortByDueDate !== 'none') {
    const dir = sortByDueDate === 'asc' ? 1 : -1;
    const sortFn = (a: RDAccount, b: RDAccount) => {
      const da = new Date(a.nextInstallmentDueDate).getTime();
      const db = new Date(b.nextInstallmentDueDate).getTime();
      return (da - db) * dir;
    };
    selectedAccounts = [...selectedAccounts].sort(sortFn);
    nonSelectedAccounts = [...nonSelectedAccounts].sort(sortFn);
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#fcfbeb] flex items-center justify-center">
        <CircularLoader />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbeb] pb-24">
      {/* Header */}
      <div className="bg-[#ad010d] text-white p-4 sticky top-0 z-40">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <ArrowLeft size={24} />
          </button>
          <h1 className="text-xl font-semibold flex-1">Create Payment Report</h1>
        </div>

        {/* Search Bar */}
        <div className="flex items-center gap-2 bg-white/100 rounded-full px-4 py-2">
          <Search size={20} className='text-[#ad010d]' />
          <input
            type="text"
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="flex-1 bg-transparent outline-none placeholder-white/300"
          />
        </div>

        {/* Payment Method Selector */}
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => handlePaymentMethodChange('cash')}
            className={`flex-1 py-2 rounded-xl font-medium transition ${
              paymentMethod === 'cash'
                ? 'bg-white text-[#ad010d]'
                : 'bg-white/20 text-white'
            }`}
          >
            Cash 
          </button>
          <button
            onClick={() => handlePaymentMethodChange('check')}
            className={`flex-1 py-2 rounded-xl font-medium transition ${
              paymentMethod === 'check'
                ? 'bg-white text-[#ad010d]'
                : 'bg-white/20 text-white'
            }`}
          >
            Check 
          </button>
        </div>
        {/* Denomination Slider (single handle) & Sort */}
        <div className="mt-3 bg-white/3 p-3 rounded-xl flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-white/90" />
              <span className="text-sm text-white/90">Denomination</span>
              <span className="text-xs text-white/70 ml-2">≥</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSortByDueDate(prev => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'))}
                className={`py-1 px-3 rounded-xl text-sm transition ${sortByDueDate === 'none' ? 'bg-white/20 text-white' : 'bg-white text-[#ad010d]'}`}
              >
                {sortByDueDate === 'none' ? 'Sort by Due Date' : sortByDueDate === 'asc' ? 'Due ↑' : 'Due ↓'}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 text-sm text-white/80 w-28">Selected: </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm text-white/90 font-semibold">
                  {`≥ ₹${denomValue}`}
                </div>
               
              </div>
              <input
                type="range"
                min={500}
                max={10000}
                step={500}
                value={denomValue}
                onChange={(e) => setDenomValue(Number(e.target.value))}
                className="w-full h-2 bg-white rounded-lg"
                style={{ accentColor: '#f4a84c' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Account List */}
      <div className="p-4 space-y-4">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p>No accounts found</p>
          </div>
        ) : (
          <>
            {/* Non-Selected Accounts Section (show first) */}
            {nonSelectedAccounts.length > 0 && (
              <div className="space-y-3">
                {nonSelectedAccounts.map((account) => {
                  const nextDueDate = new Date(account.nextInstallmentDueDate);
                  
                  return (
                    <div
                      key={account._id}
                      className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg text-gray-900">{account.accountName}</h3>
                          <p className="text-sm text-gray-600">A/C: {account.accountNo}</p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddAccount(account);
                          }}
                          className="p-2 bg-[#ad010d] hover:bg-[#8d0108] text-white rounded-full transition shadow-sm hover:shadow-md"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm mb-2">
                        <div>
                          <span className="text-gray-500 text-xs">Denomination</span>
                          <p className="font-medium text-gray-900">₹{parseFloat(account.denomination).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-500 text-xs">Month Paid</span>
                          <p className="font-medium text-gray-900">{account.monthPaidUpTo}</p>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-2">
                        <span className="text-gray-500 text-xs">Next Due Date</span>
                        <p className="font-medium text-gray-900">{nextDueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Divider */}
            {selectedAccounts.length > 0 && nonSelectedAccounts.length > 0 && (
              <div className="flex items-center gap-3 py-2">
                <div className="flex-1 h-px bg-gray-300"></div>
                <span className="text-xs font-medium text-gray-500 uppercase">Selected Accounts</span>
                <div className="flex-1 h-px bg-gray-300"></div>
              </div>
            )}

            {/* Selected Accounts Section (show after) */}
            {selectedAccounts.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-3 px-2">
                  Selected ({selectedAccounts.length})
                </h2>
                <div className="space-y-3">
                  {selectedAccounts.map((account) => {
                    const inCart = currentSession?.items.find(item => item.account === account._id);
                    const nextDueDate = new Date(account.nextInstallmentDueDate);
                    
                    return (
                      <div
                        key={account._id}
                        className="bg-gradient-to-br from-[#ad010d] to-[#8d0108] rounded-xl p-4 shadow-lg text-white"
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <h3 className="font-bold text-lg">{account.accountName}</h3>
                            <p className="text-sm text-white/80">A/C: {account.accountNo}</p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddAccount(account);
                            }}
                            className="p-2 bg-white/20 hover:bg-white/30 rounded-full transition"
                          >
                            <Check size={20} />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                          <div className="bg-white/10 rounded-lg p-2">
                            <span className="text-white/70 text-xs">Denomination</span>
                            <p className="font-semibold">₹{parseFloat(account.denomination).toFixed(2)}</p>
                          </div>
                          <div className="bg-white/10 rounded-lg p-2">
                            <span className="text-white/70 text-xs">Month Paid</span>
                            <p className="font-semibold">{account.monthPaidUpTo}</p>
                          </div>
                        </div>

                        <div className="bg-white/10 rounded-lg p-2">
                          <span className="text-white/70 text-xs">Next Due Date</span>
                          <p className="font-semibold">{nextDueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </div>

                        {inCart && (
                          <div className="mt-3 flex items-center justify-between bg-white/20 rounded-lg p-2">
                            <span className="text-sm font-medium">Installments:</span>
                            <span className="font-bold text-lg">{inCart.installments}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <button
          onClick={() => setShowCart(true)}
          className="fixed bottom-6 left-6 bg-[#ad010d] text-white p-4 rounded-full shadow-lg hover:shadow-xl transition z-50"
        >
          <div className="relative">
            
            <PackagePlus size={44} />
            <span className="absolute -top-2 -right-2 bg-white text-[#ad010d] text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center">
              {cartCount}
            </span>
          </div>
        </button>
      )}

      {/* Cart Modal - Centered with Animation */}
      {showCart && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] rounded-2xl overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">
            {/* Cart Header */}
            <div className="bg-gradient-to-r from-[#ad010d] to-[#8d0108] text-white p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold">Selected Accounts</h2>
                  <p className="text-white/80 text-sm mt-1">{cartCount} account(s) • ₹{cartTotal.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setShowCart(false)}
                  className="p-2 hover:bg-white/20 rounded-full transition"
                >
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* Cart Items */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {currentSession?.items.map((item) => {
                const account = accounts.find(a => a._id === item.account);
                if (!account) return null;

                const nextDueDate = new Date(account.nextInstallmentDueDate);

                return (
                  <div key={item.account} className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-5 border border-gray-200 hover:shadow-md transition">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="font-bold text-lg text-gray-900">{account.accountName}</h3>
                        <p className="text-sm text-gray-600">{account.accountNo}</p>
                        <div className="mt-2 bg-white rounded-lg p-2 inline-block">
                          <span className="text-xs text-gray-500">Next Due: </span>
                          <span className="text-sm font-semibold text-gray-900">
                            {nextDueDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          const account = accounts.find(a => a._id === item.account);
                          removeFromCart(item.account, account?.accountNo || 'Account');
                        }}
                        className="p-2 text-red-500 hover:bg-red-50 rounded-full transition"
                      >
                        <X size={20} />
                      </button>
                    </div>

                    <div className="bg-white rounded-lg p-3 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-600">Denomination × Installments</span>
                        <span className="font-semibold text-gray-900">
                          ₹{parseFloat(item.denomination).toFixed(2)} × {item.installments} = ₹{parseFloat(item.contribution).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Installment Controls */}
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => updateInstallments(item.account, -1)}
                        disabled={item.installments <= 1}
                        className="p-3 bg-gray-200 hover:bg-gray-300 rounded-xl disabled:opacity-30 disabled:hover:bg-gray-200 transition shadow-sm"
                      >
                        <Minus size={20} />
                      </button>
                      <div className="flex-1 text-center bg-[#ad010d] text-white rounded-xl py-3">
                        <span className="text-2xl font-bold">{item.installments}</span>
                        <span className="text-sm ml-2 opacity-90">installment{item.installments !== 1 ? 's' : ''}</span>
                      </div>
                      <button
                        onClick={() => updateInstallments(item.account, 1)}
                        disabled={item.installments >= 12}
                        className="p-3 bg-gray-200 hover:bg-gray-300 rounded-xl disabled:opacity-30 disabled:hover:bg-gray-200 transition shadow-sm"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Cart Footer */}
            <div className="border-t bg-gradient-to-b from-white to-gray-50 p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-gray-700">Total Amount:</span>
                <span className={`text-3xl font-bold ${cartTotal > 20000 && paymentMethod === 'cash' ? 'text-red-500' : 'text-[#ad010d]'}`}>
                  ₹{cartTotal.toFixed(2)}
                </span>
              </div>

              {cartTotal > 20000 && paymentMethod === 'cash' && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
                  <div className="text-red-500 mt-0.5">⚠️</div>
                  <div>
                    <p className="font-semibold mb-1">Cash payment limit exceeded!</p>
                    <p>Switch to Check payment or reduce installments to continue.</p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={handleCancelCart}
                  className="py-4 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition shadow-sm hover:shadow-md"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddToConfirmReport}
                  disabled={cartTotal > 20000 && paymentMethod === 'cash'}
                  className="py-4 bg-gradient-to-r from-[#ad010d] to-[#8d0108] text-white rounded-xl font-semibold hover:shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                >
                  <Check size={22} />
                  Add to Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmationDialog
        isOpen={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false);
          setItemToRemove(null);
        }}
        onConfirm={confirmRemoveFromCart}
        title="Remove from Cart"
        message={`Are you sure you want to remove account ${itemToRemove?.accountNo} from the cart?`}
        confirmText="Remove"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}
