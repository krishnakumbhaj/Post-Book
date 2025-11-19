'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import RDAccountCard from '@/components/RDAccountCard';
import { useToast } from '@/components/ui/use-toast';

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

export default function RDAccountDetailPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const id = pathname.split('/').pop() || '';

  const [account, setAccount] = useState<RDAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchAccount = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/rd-account/display?id=${encodeURIComponent(id)}`);
        const data = await res.json();
        if (data.ok && data.account) {
          setAccount(data.account);
        } else {
          toast({ title: 'Error', description: data.error || 'Account not found', variant: 'destructive' });
        }
      } catch (err) {
        console.error('Error fetching account:', err);
        toast({ title: 'Error', description: 'Failed to load account', variant: 'destructive' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchAccount();
  }, [id, toast]);

  const handleEdit = (accountId: string) => {
    router.push(`/rd-account/edit?id=${accountId}`);
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Delete this RD account?')) return;
    try {
      const res = await fetch(`/api/rd-account/delete?id=${accountId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.ok) {
        toast({ title: 'Deleted', description: 'RD account deleted' });
        router.push('/rd-account/display');
      } else {
        toast({ title: 'Error', description: data.error || 'Failed to delete', variant: 'destructive' });
      }
    } catch (err) {
      console.error('Delete error:', err);
      toast({ title: 'Error', description: 'Failed to delete', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbeb] p-6">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">RD Account Details</h1>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ad010d]"></div>
        </div>
      ) : account ? (
        <div className="max-w-3xl mx-auto">
          <RDAccountCard account={account} onEdit={handleEdit} onDelete={handleDelete} />
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-gray-600">Account not found.</p>
        </div>
      )}
    </div>
  );
}
