'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Switch } from '@/components/ui/switch';
import CircularLoader from '@/components/CircularLoader';

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
  openingDate: string;
  denomination: string;
  totalDepositAmount: string;
  monthPaidUpTo: number;
  nextInstallmentDueDate: string;
  lastDepositDate?: string;
}

export default function DisplayRDAccountsPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const displayName = session?.user?.username || session?.user?.email?.split('@')[0] || 'User';
  const [searchQuery, setSearchQuery] = useState('');
  const [accounts, setAccounts] = useState<RDAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [includeMatured, setIncludeMatured] = useState(false); // Default to false - show only active accounts

  const filteredAccounts = accounts.filter((acc) =>
    acc.accountName.toLowerCase().includes(searchQuery.toLowerCase()) || acc.accountNo.includes(searchQuery)
  );

  const fetchAccounts = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const response = await fetch(`/api/rd-account/display?includeMatured=${includeMatured ? 'true' : 'false'}`);
      const data = await response.json();

      if (data?.ok) {
        setAccounts(data.accounts || []);
      } else {
        toast({
          title: 'Error',
          description: data?.error || 'Failed to fetch accounts',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [includeMatured, toast]);

  useEffect(() => {
    if (session) {
      fetchAccounts();
    }
  }, [session, fetchAccounts, includeMatured]);

  // keep page render and show skeletons in list when loading

  return (
    <div className="min-h-screen bg-[#fcfbeb] p-6">
      {/* Top search bar with back + search + user circle + refresh */}
      <div className="mb-4">
        <div className="flex items-center gap-3 justify-between">
          <div className="flex items-center gap-3 flex-1">
            <Button variant="ghost" size="icon" onClick={() => router.push('/Home')} className="rounded-full">
              <ArrowLeft className="h-6 w-6" />
            </Button>

            <div className="flex-1 flex items-center gap-3 bg-white rounded-full px-3 py-2 shadow-sm">
              <Search className="text-gray-500" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search accounts"
                onFocus={() => router.push('/search')}
                className="flex-1 bg-transparent outline-none text-gray-800"
              />
            </div>

            <div className="w-10 h-10 min-w-[40px] min-h-[40px] rounded-full bg-[#ad010d] text-white flex items-center justify-center font-bold ml-2 flex-shrink-0">
              {displayName.charAt(0).toUpperCase()}
            </div>
          </div>

          
        </div>

        {/* counts + add button, with actions aligned responsively */}
        <div className="mt-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex items-center gap-4">
            <div className="bg-[#c4b701] rounded-xl shadow flex items-center gap-4 h-12 px-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#c4b701] font-bold text-lg">
                {accounts.length}
              </div>
              <div className="flex flex-col justify-center">
                <p className="text-xs text-gray-100">Total RD Accounts</p>
              </div>
            </div>

            <Button onClick={() => router.push('/rd-account/create')} className="bg-[#ad010d] hover:bg-[#8d0108] text-white px-4 rounded-xl h-12 flex items-center">
              <Plus className="mr-2 h-4 w-4" />
              Add New Account
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="icon" onClick={() => fetchAccounts()} disabled={isRefreshing} className="rounded-full">
              <RefreshCw className={`h-5 w-5 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-700">Show matured</label>
              <Switch
                checked={includeMatured}
                onCheckedChange={(val: boolean) => setIncludeMatured(Boolean(val))}
                aria-label="Include matured accounts"
                className="text-[#ad010d] bg-[#ad010d]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Accounts list area */}
      <div className="max-w-7xl mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <CircularLoader />
          </div>
        ) : filteredAccounts.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-[#fcfbeb] rounded-lg p-8 max-w-md mx-auto shadow-sm">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No RD Accounts Yet</h3>
              <p className="text-gray-600 mb-6">You haven&apos;t created any RD accounts yet. Click the button below to get started.</p>
              <Button onClick={() => router.push('/rd-account/create')} className="bg-[#ad010d] hover:bg-[#8d0108] text-white">
                <Plus className="mr-2 h-4 w-4" />
                Create Your First Account
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAccounts.map((account) => (
              <button
                key={account._id}
                onClick={() => router.push(`/rd-account/${account._id}`)}
                className="w-full flex items-center gap-4 p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition"
              >
                <div className="w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-[#ad010d] flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
                  {account.accountName?.charAt(0).toUpperCase()}
                </div>

                <div className="flex-1 text-left">
                  <div className="text-sm font-medium text-gray-800">{account.accountName}</div>
                  <div className="text-xs text-gray-500 mt-1">{account.accountNo}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Summary removed; displaying total count in header instead */}
    </div>
  );
}
