'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';

export default function CreateRDAccountPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<Array<{ _id: string; username: string; email: string }>>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const isAgent = session?.user?.role === 'Agent';
  
  const [formData, setFormData] = useState({
    accountNo: '',
    accountName: '',
    openingDate: '',
    denomination: '',
    monthPaidUpTo: '',
    nextInstallmentDueDate: '',
    lastDepositDate: '',
    maturityDate: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Fetch users if logged in as Agent
  useEffect(() => {
    const fetchUsers = async () => {
      if (isAgent) {
        try {
          const response = await fetch('/api/users/list');
          if (response.ok) {
            const data = await response.json();
            if (data.ok && data.users) {
              // Filter only users with role 'User'
              const regularUsers = data.users.filter((u: any) => u.role === 'User');
              setUsers(regularUsers);
            }
          }
        } catch (error) {
          console.error('Error fetching users:', error);
        }
      }
    };
    
    fetchUsers();
  }, [isAgent]);

  // Auto-calculate next installment due date and last deposit date
  useEffect(() => {
    if (formData.openingDate && formData.monthPaidUpTo) {
      const openingDate = new Date(formData.openingDate);
      const monthsPaid = parseInt(formData.monthPaidUpTo);

      if (!isNaN(monthsPaid) && openingDate.toString() !== 'Invalid Date') {
        // Calculate next installment due date: opening date + (monthsPaid + 1) months
        const nextDueDate = new Date(openingDate);
        nextDueDate.setMonth(nextDueDate.getMonth() + monthsPaid + 1);
        
        // Calculate last deposit date: opening date + monthsPaid months
        // This represents when the last installment was due/paid
        const lastDepositDate = new Date(openingDate);
        lastDepositDate.setMonth(lastDepositDate.getMonth() + monthsPaid);

        // Calculate maturity date: opening date + 60 months (last installment due date)
        const maturityDate = new Date(openingDate);
        maturityDate.setMonth(maturityDate.getMonth() + 60);

        // Format dates as YYYY-MM-DD for input
        const formatDate = (date: Date) => {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        };

        setFormData(prev => ({
          ...prev,
          nextInstallmentDueDate: formatDate(nextDueDate),
          lastDepositDate: formatDate(lastDepositDate),
          maturityDate: formatDate(maturityDate)
        }));
      }
    }
  }, [formData.openingDate, formData.monthPaidUpTo]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!session) {
      toast({
        title: 'Error',
        description: 'You must be logged in to create an RD account',
        variant: 'destructive',
      });
      return;
    }

    // If agent, must select a user
    if (isAgent && !selectedUserId) {
      toast({
        title: 'Error',
        description: 'Please select a user for this account',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const requestBody: any = {
        accountNo: formData.accountNo,
        accountName: formData.accountName,
        openingDate: formData.openingDate,
        denomination: parseFloat(formData.denomination),
        monthPaidUpTo: parseInt(formData.monthPaidUpTo),
        nextInstallmentDueDate: formData.nextInstallmentDueDate,
        lastDepositDate: formData.lastDepositDate || undefined,
        maturityDate: formData.maturityDate,
      };

      // If agent, include targetUserId
      if (isAgent && selectedUserId) {
        requestBody.targetUserId = selectedUserId;
      }

      const response = await fetch('/api/rd-account/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      console.log('Create RD Account Response:', { 
        status: response.status, 
        ok: response.ok, 
        data 
      });

      if (response.ok && data.ok) {
        toast({
          title: 'Success',
          description: data.message || 'RD Account created successfully',
        });
        
        // Reset form
        setFormData({
          accountNo: '',
          accountName: '',
          openingDate: '',
          denomination: '',
          monthPaidUpTo: '',
          nextInstallmentDueDate: '',
          lastDepositDate: '',
          maturityDate: '',
        });
        
        // Navigate to display page after a short delay
        setTimeout(() => {
          router.push('/rd-account/display');
        }, 1500);
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to create RD account',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating RD account:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfbeb] p-6">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="rounded-full"
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">Create RD Account</h1>
      </div>

      {/* Form Card */}
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>New Recurring Deposit Account</CardTitle>
          <CardDescription>
            Fill in the details to create a new RD account
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* User Selection - Only for Agents */}
            {isAgent && (
              <div className="space-y-2">
                <Label htmlFor="targetUser">Select User *</Label>
                <select
                  id="targetUser"
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-lg border-2 border-gray-200 focus:border-[#ad010d] focus:ring-2 focus:ring-[#ad010d]/20 outline-none transition bg-white"
                >
                  <option value="">-- Select a user --</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.username} ({user.email})
                    </option>
                  ))}
                </select>
                <p className="text-sm text-gray-500">
                  Select the user for whom this RD account is being created
                </p>
              </div>
            )}

            {/* Account Number */}
            <div className="space-y-2">
              <Label htmlFor="accountNo">Account Number *</Label>
              <Input
                id="accountNo"
                name="accountNo"
                type="text"
                placeholder="e.g., 020001065478"
                value={formData.accountNo}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>

            {/* Account Name */}
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name *</Label>
              <Input
                id="accountName"
                name="accountName"
                type="text"
                placeholder="e.g., KALPANA"
                value={formData.accountName}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>

            {/* Account Opening Date */}
            <div className="space-y-2">
              <Label htmlFor="openingDate">Account Opening Date *</Label>
              <Input
                id="openingDate"
                name="openingDate"
                type="date"
                value={formData.openingDate}
                onChange={handleInputChange}
                required
                className="w-full"
              />
            </div>

            {/* Denomination */}
            <div className="space-y-2">
              <Label htmlFor="denomination">Denomination (₹) *</Label>
              <Input
                id="denomination"
                name="denomination"
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g., 1000.00"
                value={formData.denomination}
                onChange={handleInputChange}
                required
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Monthly deposit amount
              </p>
            </div>

            {/* Months Paid Up To */}
            <div className="space-y-2">
              <Label htmlFor="monthPaidUpTo">Month Paid Up to *</Label>
              <Input
                id="monthPaidUpTo"
                name="monthPaidUpTo"
                type="number"
                min="0"
                max="60"
                step="1"
                placeholder="e.g., 58"
                value={formData.monthPaidUpTo}
                onChange={handleInputChange}
                required
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Number of months already paid (max 60 for maturity)
              </p>
            </div>

            {/* Next RD Installment Due Date */}
            <div className="space-y-2">
              <Label htmlFor="nextInstallmentDueDate">Next RD Installment Due Date *</Label>
              <Input
                id="nextInstallmentDueDate"
                name="nextInstallmentDueDate"
                type="date"
                value={formData.nextInstallmentDueDate}
                onChange={handleInputChange}
                required
                className="w-full bg-gray-50"
                readOnly
              />
              <p className="text-sm text-green-600">
                ✓ Auto-calculated from opening date and months paid
              </p>
            </div>

            {/* Date of Last Deposit */}
            <div className="space-y-2">
              <Label htmlFor="lastDepositDate">Date of Last Deposit</Label>
              <Input
                id="lastDepositDate"
                name="lastDepositDate"
                type="date"
                value={formData.lastDepositDate}
                onChange={handleInputChange}
                className="w-full bg-gray-50"
                readOnly
              />
              <p className="text-sm text-green-600">
                ✓ Auto-calculated (due date of last paid month)
              </p>
            </div>

            {/* Maturity Date */}
            <div className="space-y-2">
              <Label htmlFor="maturityDate">Account Maturity Date *</Label>
              <Input
                id="maturityDate"
                name="maturityDate"
                type="date"
                value={formData.maturityDate}
                onChange={handleInputChange}
                required
                className="w-full bg-gray-50"
                readOnly
              />
              <p className="text-sm text-green-600">
                ✓ Auto-calculated (60th installment due date)
              </p>
            </div>

            {/* Total Deposit Display */}
            {formData.denomination && formData.monthPaidUpTo && (
              <div className="space-y-3">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-gray-600">Total Deposit Amount</p>
                  <p className="text-2xl font-bold text-blue-600">
                    ₹{(parseFloat(formData.denomination) * parseInt(formData.monthPaidUpTo)).toFixed(2)}
                  </p>
                </div>
                
                {/* Maturity Info */}
                {parseInt(formData.monthPaidUpTo) < 60 && (
                  <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="text-sm text-gray-600">Months Remaining to Maturity</p>
                    <p className="text-xl font-bold text-amber-600">
                      {60 - parseInt(formData.monthPaidUpTo)} months
                    </p>
                  </div>
                )}
                
                {parseInt(formData.monthPaidUpTo) >= 60 && (
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm font-semibold text-green-700">
                      ✓ Account Matured (60 months completed)
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Submit Button */}
            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-[#ad010d] hover:bg-[#8d0108] text-white"
              >
                {isLoading ? (
                  <>Creating...</>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Create Account
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={isLoading}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
