'use client';
import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, Home, User, Calendar, TrendingUp, Wallet, AlertCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';
import dayjs from 'dayjs';
import Image from 'next/image';
import Logo from '../images/Logo.png';

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
  denomination: string;
  totalDepositAmount: string;
  monthPaidUpTo: number;
  openingDate: string;
  nextInstallmentDueDate?: string;
  maturityDate?: string;
  user: string;
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [accountNo, setAccountNo] = useState('');
  const [openingDate, setOpeningDate] = useState('');
  const [searching, setSearching] = useState(false);
  const [accounts, setAccounts] = useState<RDAccount[]>([]);
  const [searched, setSearched] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  const displayName = session?.user?.username || session?.user?.email?.split('@')[0] || 'User';

  const handleSearch = async () => {
    if (!accountNo || !openingDate) {
      toast({
        title: 'Missing Information',
        description: 'Please enter both account number and opening date',
        variant: 'destructive',
      });
      return;
    }

    setSearching(true);
    setSearched(true);
    
    try {
      const response = await axios.get('/api/rd-account/display');
      
      if (response.data.ok) {
        const allAccounts = response.data.accounts || [];
        
        const matchedAccounts = allAccounts.filter((acc: RDAccount) => 
          acc.accountNo === accountNo && 
          dayjs(acc.openingDate).format('YYYY-MM-DD') === openingDate &&
          acc.user === session?.user?.id
        );

        setAccounts(matchedAccounts);

        if (matchedAccounts.length === 0) {
          toast({
            title: 'No Account Found',
            description: 'No account found with the provided details',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Account Found',
            description: `Found ${matchedAccounts.length} account(s)`,
          });
        }
      }
    } catch (error) {
      console.error('Error searching account:', error);
      toast({
        title: 'Search Failed',
        description: 'Failed to search for account. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setSearching(false);
    }
  };

  const handleReset = () => {
    setAccountNo('');
    setOpeningDate('');
    setAccounts([]);
    setSearched(false);
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#fcfbeb] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#f4a84c]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbeb] pb-20">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#f4a84c] to-[#e89b3c] text-white p-4 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src={Logo} alt="Logo" width={40} height={40} className="bg-white rounded-full p-1" />
            <div>
              <h1 className="text-xl font-bold">RD Account Lookup</h1>
              <p className="text-sm text-white/80">Welcome, {displayName}</p>
            </div>
          </div>
          <button
            onClick={() => router.push('/profile')}
            className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-semibold hover:bg-white/30 transition"
          >
            {displayName.charAt(0).toUpperCase()}
          </button>
        </div>
      </div>

      {/* Search Section */}
      <div className="p-4">
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Search size={20} className="text-[#f4a84c]" />
            Search Your Account
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Account Number *
              </label>
              <input
                type="text"
                value={accountNo}
                onChange={(e) => setAccountNo(e.target.value)}
                placeholder="Enter your RD account number"
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#f4a84c] focus:ring-2 focus:ring-[#f4a84c]/20 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opening Date *
              </label>
              <input
                type="date"
                value={openingDate}
                onChange={(e) => setOpeningDate(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#f4a84c] focus:ring-2 focus:ring-[#f4a84c]/20 outline-none transition"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSearch}
                disabled={searching}
                className="flex-1 bg-[#f4a84c] hover:bg-[#e89b3c] text-white py-3 rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
              >
                <Search size={18} />
                {searching ? 'Searching...' : 'Search Account'}
              </button>
              <button
                onClick={handleReset}
                className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition"
              >
                Reset
              </button>
            </div>
          </div>
        </div>

        {/* Results Section */}
        {searched && (
          <div className="space-y-4">
            {accounts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
                <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">No Accounts Found</h3>
                <p className="text-gray-500">
                  No account found with the provided details. Please check your account number and opening date.
                </p>
                <div className="mt-6 flex justify-center">
                  <button
                    onClick={() => setModalOpen(true)}
                    className="bg-[#f4a84c] text-white px-6 py-3 rounded-full shadow-lg hover:bg-[#e89b3c] transition"
                  >
                    Search Again
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <Wallet size={20} className="text-[#f4a84c]" />
                  Your Accounts ({accounts.length})
                </h3>
                
                {accounts.map((account) => (
                  <div
                    key={account._id}
                    className="bg-gradient-to-br from-white to-orange-50 rounded-2xl shadow-lg overflow-hidden border-2 border-[#f4a84c]/20 hover:shadow-xl transition"
                  >
                    <div className="bg-gradient-to-r from-[#f4a84c] to-[#e89b3c] p-5 text-white">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-bold mb-1">{account.accountName}</h3>
                          <p className="text-sm text-white/80">A/C: {account.accountNo}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold">₹{parseFloat(account.denomination).toFixed(0)}</div>
                          <p className="text-xs text-white/80">Monthly</p>
                        </div>
                      </div>
                    </div>

                    <div className="p-5 space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <TrendingUp size={16} className="text-[#f4a84c]" />
                            <p className="text-xs text-gray-500 font-medium">Total Deposited</p>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            ₹{parseFloat(account.totalDepositAmount).toFixed(2)}
                          </p>
                        </div>

                        <div className="bg-white rounded-xl p-4 border border-gray-200">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar size={16} className="text-[#f4a84c]" />
                            <p className="text-xs text-gray-500 font-medium">Months Paid</p>
                          </div>
                          <p className="text-xl font-bold text-gray-900">
                            {account.monthPaidUpTo} months
                          </p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                          <span className="text-sm text-gray-600 font-medium">Opening Date</span>
                          <span className="text-sm font-semibold text-gray-900">
                            {dayjs(account.openingDate).format('DD-MMM-YYYY')}
                          </span>
                        </div>

                        {account.nextInstallmentDueDate && (
                          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                            <span className="text-sm text-gray-600 font-medium">Next Due Date</span>
                            <span className="text-sm font-semibold text-[#f4a84c]">
                              {dayjs(account.nextInstallmentDueDate).format('DD-MMM-YYYY')}
                            </span>
                          </div>
                        )}

                        {account.maturityDate && (
                          <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                            <span className="text-sm text-gray-600 font-medium">Maturity Date</span>
                            <span className="text-sm font-semibold text-gray-900">
                              {dayjs(account.maturityDate).format('DD-MMM-YYYY')}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-blue-800">
                          This is a read-only view. Contact your agent for any modifications.
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* Floating action button when at least one account is present */}
      {accounts.length > 0 && (
        <button
          onClick={() => setModalOpen(true)}
          className="fixed bottom-28 right-6 z-50 bg-[#f4a84c] text-white p-4 rounded-full shadow-2xl hover:scale-105 transform transition"
          aria-label="Open search"
        >
          <Search size={20} />
        </button>
      )}

      {/* Modal: pop-style search form */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setModalOpen(false)}
          />

          <div className="relative bg-white rounded-2xl p-6 w-[92%] max-w-md shadow-2xl transform transition-all duration-150 scale-100">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Search RD Account</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Account Number *</label>
                <input
                  type="text"
                  value={accountNo}
                  onChange={(e) => setAccountNo(e.target.value)}
                  placeholder="Enter your RD account number"
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#f4a84c] focus:ring-2 focus:ring-[#f4a84c]/20 outline-none transition"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Opening Date *</label>
                <input
                  type="date"
                  value={openingDate}
                  onChange={(e) => setOpeningDate(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#f4a84c] focus:ring-2 focus:ring-[#f4a84c]/20 outline-none transition"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={async () => {
                    await handleSearch();
                    setModalOpen(false);
                  }}
                  className="flex-1 bg-[#f4a84c] hover:bg-[#e89b3c] text-white py-3 rounded-xl font-semibold transition disabled:opacity-50"
                >
                  Search
                </button>
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-medium transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#fcfbeb] rounded-tr-3xl shadow-2xl border-t-2 border-gray-200">
        <div className="grid grid-cols-2 px-6 py-4">
          <button 
            onClick={() => router.push('/dashboard')}
            className="flex flex-col items-center gap-1 text-[#f4a84c] transition-colors"
          >
            <div className="bg-[#f4a84c] text-white rounded-full p-3 shadow-lg">
              <Home size={24} />
            </div>
            <span className="text-xs font-medium">Home</span>
          </button>

          <button 
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#f4a84c] transition-colors"
          >
            <div className="bg-gray-100 rounded-full p-3 hover:bg-gray-200 transition">
              <User size={24} />
            </div>
            <span className="text-xs">Profile</span>
          </button>
        </div>
      </div>
    </div>
  );
}