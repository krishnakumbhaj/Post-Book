'use client';

import React from 'react';
// account-based avatar; no session required
import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Hash, User, TrendingUp } from 'lucide-react';

interface RDAccountCardProps {
  account: {
    _id: string;
    accountNo: string;
    accountName: string;
    openingDate: string;
    denomination: string;
    totalDepositAmount: string;
    monthPaidUpTo: number;
    nextInstallmentDueDate: string;
    lastDepositDate?: string;
  };
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
}

export default function RDAccountCard({ account, onEdit, onDelete }: RDAccountCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short', 
      year: 'numeric' 
    });
  };

  const formatCurrency = (amount: string) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(parseFloat(amount));
  };
  const ownerName = account.accountName || '';
  const ownerInitial = ownerName ? ownerName.charAt(0).toUpperCase() : '?';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <CardContent className="p-6 space-y-4">
        {/* Header with Account Number */}
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-2">
            <Hash className="h-5 w-5 text-[#ad010d]" />
            <span className="font-mono text-lg font-semibold text-gray-900">
              {account.accountNo}
            </span>
          </div>
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-[#ad010d] flex items-center justify-center text-sm font-semibold text-white">
              {ownerInitial}
            </div>
          </div>
        </div>

        {/* Account Name */}
        <div className="flex items-center gap-3">
          <User className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Account Name</p>
            <p className="font-semibold text-gray-900">{account.accountName}</p>
          </div>
        </div>

        {/* Opening Date */}
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Account Opening Date</p>
            <p className="font-medium text-gray-900">{formatDate(account.openingDate)}</p>
          </div>
        </div>

        {/* Denomination and Total Deposit - Two Columns */}
        <div className="grid grid-cols-2 gap-4 bg-blue-50 p-4 rounded-lg">
          <div>
            <p className="text-xs text-gray-600">Denomination</p>
            <p className="font-bold text-blue-700 text-lg">
              {formatCurrency(account.denomination)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-600">Total Deposit</p>
            <p className="font-bold text-green-700 text-lg">
              {formatCurrency(account.totalDepositAmount)}
            </p>
          </div>
        </div>

        {/* Month Paid Up To */}
        <div className="flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-gray-500" />
          <div>
            <p className="text-xs text-gray-500">Month Paid Up to</p>
            <p className="font-semibold text-gray-900">{account.monthPaidUpTo} months</p>
          </div>
        </div>

        {/* Next Installment Due Date */}
        <div className="flex items-center gap-3 bg-yellow-50 p-3 rounded-lg border border-yellow-200">
          <Calendar className="h-5 w-5 text-yellow-600" />
          <div>
            <p className="text-xs text-yellow-700 font-medium">Next RD Installment Due</p>
            <p className="font-semibold text-gray-900">{formatDate(account.nextInstallmentDueDate)}</p>
          </div>
        </div>

        {/* Last Deposit Date (if exists) */}
        {account.lastDepositDate && (
          <div className="flex items-center gap-3">
            <Calendar className="h-5 w-5 text-gray-500" />
            <div>
              <p className="text-xs text-gray-500">Date of Last Deposit</p>
              <p className="font-medium text-gray-900">{formatDate(account.lastDepositDate)}</p>
            </div>
          </div>
        )}

        {/* Action Buttons (if callbacks provided) */}
        {(onEdit || onDelete) && (
          <div className="flex gap-3 pt-3 border-t">
            {onEdit && (
              <button
                onClick={() => onEdit(account._id)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Edit
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(account._id)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-medium transition-colors"
              >
                Delete
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
