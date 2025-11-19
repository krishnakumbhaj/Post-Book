'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Search, ChevronLeft } from 'lucide-react';

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
}

export default function SearchPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [accounts, setAccounts] = useState<RDAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/rd-account/display');
        const data = await res.json();
        if (data.ok) setAccounts(data.accounts || []);
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };

    if (session) fetchAccounts();
  }, [session]);

  const filtered = accounts.filter((acc) =>
    acc.accountName.toLowerCase().includes(query.toLowerCase()) || acc.accountNo.includes(query)
  );

  return (
    <div className="fixed inset-0 z-50 bg-[#fcfbeb] flex flex-col">
      <div className="p-4 pt-6 flex items-center gap-3 border-b">
        <button onClick={() => router.back()} className="text-gray-600 mr-1">
          <ChevronLeft size={20} />
        </button>
        <Search className="text-gray-600" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search accounts"
          className="flex-1 outline-none text-gray-800 bg-transparent ml-2"
        />
      </div>

      <div className="p-2 overflow-y-auto flex-1">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-3 bg-[#fcfbeb] rounded-lg shadow-sm">
                <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-1/3 mb-2 animate-pulse" />
                  <div className="h-2 bg-gray-200 rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((account) => (
              <button
                key={account._id}
                onClick={() => router.push(`/rd-account/${account._id}`)}
                className="w-full flex items-center gap-4 p-3 bg-[#f4f3e6] rounded-xl shadow-sm hover:bg-gray-50 transition"
              >
                <div className="w-12 h-12 rounded-full bg-[#ad010d] flex items-center justify-center text-white font-semibold text-lg">
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
    </div>
  );
}
