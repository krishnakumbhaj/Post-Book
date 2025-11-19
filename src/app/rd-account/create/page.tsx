'use client';

import React, { useState } from 'react';
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
  
  const [formData, setFormData] = useState({
    accountNo: '',
    accountName: '',
    openingDate: '',
    denomination: '',
    monthPaidUpTo: '',
    nextInstallmentDueDate: '',
    lastDepositDate: '',
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

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

    setIsLoading(true);

    try {
      const response = await fetch('/api/rd-account/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          accountNo: formData.accountNo,
          accountName: formData.accountName,
          openingDate: formData.openingDate,
          denomination: parseFloat(formData.denomination),
          monthPaidUpTo: parseInt(formData.monthPaidUpTo),
          nextInstallmentDueDate: formData.nextInstallmentDueDate,
          lastDepositDate: formData.lastDepositDate || undefined,
        }),
      });

      const data = await response.json();

      if (data.ok) {
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
                step="1"
                placeholder="e.g., 58"
                value={formData.monthPaidUpTo}
                onChange={handleInputChange}
                required
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Number of months already paid
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
                className="w-full"
              />
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
                className="w-full"
              />
              <p className="text-sm text-gray-500">
                Optional - leave blank if no deposit made yet
              </p>
            </div>

            {/* Total Deposit Display */}
            {formData.denomination && formData.monthPaidUpTo && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-600">Total Deposit Amount</p>
                <p className="text-2xl font-bold text-blue-600">
                  ₹{(parseFloat(formData.denomination) * parseInt(formData.monthPaidUpTo)).toFixed(2)}
                </p>
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
