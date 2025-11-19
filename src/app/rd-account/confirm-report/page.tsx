'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Check, X, AlertCircle, Undo2, Plus, Home, User, FileText, Eye } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';
import dayjs from 'dayjs';
import { NotepadTextDashed } from 'lucide-react';
import logo from '@/app/images/Logo.png';
import logo_name from '@/app/images/Logo_name.png';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

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
  committedAt?: string;
  allowRevertUntil?: string;
  createdAt: string;
}

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
  denomination: string;
  totalDepositAmount: string;
  monthPaidUpTo: number;
  openingDate?: string;
  nextInstallmentDueDate?: string;
}

export default function ConfirmReportPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useToast();

  const [sessions, setSessions] = useState<PaymentSession[]>([]);
  const [accounts, setAccounts] = useState<RDAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [reverting, setReverting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role === 'Agent') {
      loadData();
    } else if (status === 'authenticated' && session?.user?.role !== 'Agent') {
      toast({
        title: 'Access Denied',
        description: 'Only agents can access this page',
        variant: 'destructive',
      });
      router.push('/dashboard');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, session]);

  const loadData = async () => {
    setLoading(true);
    try {
      const sessionsResponse = await axios.get('/api/rd-account/payment-session?status=ongoing');
      const committedResponse = await axios.get('/api/rd-account/payment-session?status=committed');
      
      const ongoingSessions = sessionsResponse.data.sessions || [];
      const committedSessions = committedResponse.data.sessions || [];
      
      const filteredOngoing = ongoingSessions.filter((s: PaymentSession) => 
        s.items.some(item => item.added)
      );
      
      setSessions([...filteredOngoing, ...committedSessions]);

      const accountsResponse = await axios.get('/api/rd-account/display');
      if (accountsResponse.data.ok) {
        setAccounts(accountsResponse.data.accounts || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load sessions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async (sessionId: string) => {
    setCommitting(true);
    try {
      const response = await axios.post(`/api/rd-account/payment-session/${sessionId}/commit`, {});

      if (response.data.ok) {
        toast({
          title: 'Success',
          description: 'Payment report committed successfully',
        });
        await loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Commit Failed',
        description: error.response?.data?.error || 'Failed to commit report',
        variant: 'destructive',
      });
    } finally {
      setCommitting(false);
    }
  };

  const handleRevert = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revert this payment? This will undo all changes.')) {
      return;
    }

    setReverting(true);
    try {
      const response = await axios.post(`/api/rd-account/payment-session/${sessionId}/revert`);

      if (response.data.ok) {
        toast({
          title: 'Success',
          description: 'Payment reverted successfully',
        });
        await loadData();
      }
    } catch (error: any) {
      toast({
        title: 'Revert Failed',
        description: error.response?.data?.error || 'Failed to revert payment',
        variant: 'destructive',
      });
    } finally {
      setReverting(false);
    }
  };

  const handleDownloadPDF = async (sessionId: string) => {
    const session = sessions.find(s => s._id === sessionId);
    if (!session) return;

    const rows: Array<any[]> = [];
    for (const item of session.items.filter(i => i.added)) {
      const acc = getAccountDetails(item.account) as (RDAccount | undefined);

      let dueDateStr = '';
      if (acc && acc.nextInstallmentDueDate) {
        dueDateStr = dayjs(acc.nextInstallmentDueDate).format('DD-MMM-YYYY');
      } else if (acc && acc.openingDate) {
        dueDateStr = dayjs(acc.openingDate).add(acc.monthPaidUpTo, 'month').format('DD-MMM-YYYY');
      } else {
        dueDateStr = dayjs(session.committedAt || session.createdAt).format('DD-MMM-YYYY');
      }

      rows.push([
        session._id.substring(0, 8),
        acc?.accountNo || item.account,
        acc?.accountName || 'Unknown',
        parseFloat(item.denomination).toFixed(2) + ' Cr.',
        parseFloat(item.contribution).toFixed(2) + ' Cr.',
        String(item.installments),
        dueDateStr
      ]);
    }

    try {
      const jsPDFModule = await import('jspdf');
      const { jsPDF } = jsPDFModule;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule && (autoTableModule.default || autoTableModule);

      const imageUrlToDataUrl = async (url: string) => {
        try {
          const res = await fetch(url);
          const blob = await res.blob();
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
        } catch {
          return '';
        }
      };

      let logoDataUrl = '';
      let logoNameDataUrl = '';
      
      try {
        const resolveSrc = (img: unknown): string => {
          if (!img) return '';
          if (typeof img === 'string') return img;
          if (typeof img === 'object' && img !== null && 'src' in (img as any)) {
            return (img as any).src as string;
          }
          return '';
        };

        const logoSrc = resolveSrc(logo);
        if (logoSrc) {
          const d = await imageUrlToDataUrl(logoSrc);
          if (d) logoDataUrl = d;
        }

        const logoNameSrc = resolveSrc(logo_name);
        if (logoNameSrc) {
          const d = await imageUrlToDataUrl(logoNameSrc);
          if (d) logoNameDataUrl = d;
        }
      } catch (e) {
        console.error('Error loading logos:', e);
      }

      const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'landscape' });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();

      if (!autoTable) throw new Error('autoTable not available');

      const totalAmount = rows.reduce((sum, row) => sum + parseFloat(row[4].replace(' Cr.', '')), 0);
      const totalRecords = rows.length;

      autoTable(doc, {
        startY: 170,
        head: [[
          'E-Banking Ref No',
          'RD Account Number',
          'Account Name',
          'RD Denomination',
          'RD Total Deposit Amount',
          'No of Installments',
          'Due Date'
        ]],
        body: rows,
        styles: { 
          fontSize: 9,
          cellPadding: 4,
          lineColor: [200, 200, 200],
          lineWidth: 0.5
        },
        headStyles: { 
          fillColor: [220, 220, 220],
          textColor: [0, 0, 0],
          fontStyle: 'bold',
          halign: 'center',
          fontSize: 9
        },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 110 },
          2: { cellWidth: 200 },
          3: { cellWidth: 100, halign: 'right' },
          4: { cellWidth: 120, halign: 'right' },
          5: { cellWidth: 90, halign: 'center' },
          6: { cellWidth: 100, halign: 'center' }
        },
        didDrawPage: (data) => {
          if (logoDataUrl) {
            try {
              doc.addImage(logoDataUrl, 'PNG', 30, 15, 60, 60);
            } catch {
              console.error('Error adding logo');
            }
          }
          
          if (logoNameDataUrl) {
            try {
              doc.addImage(logoNameDataUrl, 'PNG', 100, 30, 150, 30);
            } catch {
              console.error('Error adding logo name');
            }
          }

          doc.setFontSize(14);
          (doc as any).setFont('helvetica', 'bold');
          doc.text('RECURRING DEPOSIT INSTALLMENT REPORT', pageWidth / 2, 110, { align: 'center' } as any);

          doc.setFontSize(9);
          (doc as any).setFont('helvetica', 'bold');
          doc.text('Search Criteria', 30, 135);
          
          (doc as any).setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Agent Id: ${session.user || 'N/A'}`, 100, 135);
          doc.text(`From Date: ${dayjs(session.createdAt).format('DD-MMM-YYYY')} To Date: ${dayjs(session.createdAt).format('DD-MMM-YYYY')}`, 250, 135);
          doc.text(`List Reference No: ${session._id.substring(0, 10).toUpperCase()}`, 500, 135);
          doc.text(`Status: Success`, 100, 150);
          doc.text(`Cheque No.: ${session.paymentMethod === 'check' ? 'Yes' : 'N/A'}`, 250, 150);
          doc.text(`Type Of Report: SR`, 500, 150);

          doc.setFontSize(9);
          (doc as any).setFont('helvetica', 'bold');
          doc.text('Search Results', 30, (data as any).cursor?.y ? (data as any).cursor.y + 15 : pageHeight - 80);
          
          (doc as any).setFont('helvetica', 'normal');
          doc.setFontSize(8);
          doc.text(`Total Amount: ${totalAmount.toFixed(2)} Cr.`, 100, (data as any).cursor?.y ? (data as any).cursor.y + 15 : pageHeight - 80);
          doc.text(`Total No Of Records: ${totalRecords}`, 250, (data as any).cursor?.y ? (data as any).cursor.y + 15 : pageHeight - 80);

          doc.setFontSize(7);
          doc.text(`Generated on: ${dayjs().format('DD-MMM-YYYY HH:mm:ss A')}`, 30, pageHeight - 20);
          
          const pageCount = (doc as any).getNumberOfPages ? (doc as any).getNumberOfPages() : 1;
          const page = (doc as any).getCurrentPageInfo ? (doc as any).getCurrentPageInfo().pageNumber : 1;
          doc.text(`Page ${page} of ${pageCount}`, pageWidth - 80, pageHeight - 20);
        },
        margin: { top: 170, left: 30, right: 30, bottom: 40 }
      });

      doc.save(`RD-Report-${session._id}.pdf`);
      
      toast({
        title: 'PDF Generated',
        description: 'Report downloaded successfully',
      });
    } catch (err) {
      console.error('PDF generation failed:', err);
      toast({
        title: 'PDF Error',
        description: 'PDF generation requires `jspdf` and `jspdf-autotable`. Run `npm i jspdf jspdf-autotable` and retry.',
        variant: 'destructive',
      });
    }
  };

  const handleCancel = async (sessionId: string) => {
    if (!confirm('Are you sure you want to cancel this session?')) {
      return;
    }

    try {
      await axios.delete(`/api/rd-account/payment-session/${sessionId}`);
      toast({
        title: 'Cancelled',
        description: 'Session cancelled successfully',
      });
      await loadData();
    } catch (err: any) {
      console.error('Cancel session failed:', err);
      toast({
        title: 'Error',
        description: err?.response?.data?.error || 'Failed to cancel session',
        variant: 'destructive',
      });
    }
  };

  const getAccountDetails = (accountId: string) => {
    return accounts.find(a => a._id === accountId);
  };

  const canRevert = (session: PaymentSession) => {
    if (!session.allowRevertUntil) return false;
    const now = new Date();
    const revertUntil = new Date(session.allowRevertUntil);
    return now <= revertUntil;
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-[#fcfbeb] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ad010d]"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfbeb] pb-20">
      {/* Header */}
      <div className="bg-[#ad010d] text-white p-4 sticky top-0 z-40 shadow-lg">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Payment Reports</h1>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-sm text-white/90">
                Pending: <span className="font-bold text-yellow-300">{sessions.filter(s => s.status !== 'committed').length}</span>
              </span>
              <span className="text-sm text-white/90">
                Completed: <span className="font-bold text-green-300">{sessions.filter(s => s.status === 'committed').length}</span>
              </span>
            </div>
          </div>
          <button
            onClick={() => router.push('/rd-account/report')}
            className="p-2 bg-[#f4a84c] hover:bg-white/30 rounded-full transition"
            title="Create new report"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Sessions List */}
      <div className="p-4 space-y-4">
        {sessions.length === 0 ? (
          <div className="text-center py-16">
            <div className="bg-white rounded-2xl p-8 shadow-sm max-w-md mx-auto">
              <AlertCircle className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700 mb-2">No Reports Found</h3>
              <p className="text-gray-500 mb-6">You haven&apos;t created any payment reports yet</p>
              <button
                onClick={() => router.push('/rd-account/report')}
                className="bg-[#ad010d] hover:bg-[#8d0108] text-white px-6 py-3 rounded-lg font-medium transition shadow-md hover:shadow-lg"
              >
                Create Your First Report
              </button>
            </div>
          </div>
        ) : (
          sessions.map((session) => {
            const addedItems = session.items.filter(item => item.added);
            const total = parseFloat(session.totalAmount);
            const isCommitted = session.status === 'committed';
            const canRevertSession = canRevert(session);

            return (
              <div
                key={session._id}
                className={`rounded-2xl shadow-lg overflow-hidden transition-all hover:shadow-xl ${
                  isCommitted ? 'bg-gradient-to-br from-green-50 to-white border-2 border-green-400' : 'bg-white border-2 border-gray-200'
                }`}
              >
                {/* Card Header */}
                <div className={`p-5 relative ${isCommitted ? 'bg-gradient-to-r from-green-100 to-green-50' : 'bg-gradient-to-r from-gray-50 to-white'}`}>
                  {/* PDF Download Button - Top Right */}
                  <button
                    onClick={() => handleDownloadPDF(session._id)}
                    className="absolute top-24 right-4 p-2.5 bg-[#ad010d] hover:bg-[#ad010d] hover:text-white textwhite rounded-full shadow-md transition-all hover:scale-105"
                    title="Download PDF Report"
                  >
                    <FileText className='text-white' size={20} />
                  </button>

                  <div className="flex items-start justify-between pr-16">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        {isCommitted ? (
                          <span className="inline-flex items-center gap-2 bg-green-600 text-white text-sm px-3 py-1.5 rounded-full font-medium shadow-sm">
                            <Check size={16} /> Completed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 bg-yellow-500 text-white text-sm px-3 py-1.5 rounded-full font-medium shadow-sm">
                            <AlertCircle size={16} /> Pending
                          </span>
                        )}
                        <span className="text-xs text-gray-500  px-2 py-1 rounded">
                          {dayjs(session.createdAt).format('MMM D, YYYY')}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 flex items-center gap-2">
                        <span className="font-medium">Payment:</span>
                        <span className="capitalize  px-2 py-0.5 rounded text-xs">{session.paymentMethod}</span>
                      </p>
                      {session.committedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          Committed: {dayjs(session.committedAt).format('MMM D, YYYY h:mm A')}
                        </p>
                      )}
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-2xl font-bold text-[#ad010d] mb-1">₹{total.toFixed(2)}</div>
                      <div className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full inline-block">
                        {addedItems.length} account{addedItems.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>

                  {/* Revert Warning */}
                  {isCommitted && canRevertSession && session.allowRevertUntil && (
                    <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-400 rounded-r-lg p-3">
                      <div className="flex items-start gap-2">
                        <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm">
                          <p className="text-yellow-800 font-medium">Revert available until {dayjs(session.allowRevertUntil).format('MMM D, h:mm A')}</p>
                          <p className="text-yellow-700 text-xs mt-0.5">{dayjs(session.allowRevertUntil).diff(dayjs(), 'day')} days remaining</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Account Preview - Max 3 items */}
                <div className="p-5">
                  <div className="space-y-3">
                    {addedItems.slice(0, 3).map((item) => {
                      const account = getAccountDetails(item.account);
                      if (!account) return null;

                      return (
                        <div key={item.account} className="flex items-center justify-between bg-gray-50 rounded-xl p-4 hover:bg-gray-100 transition border border-gray-200">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{account.accountName}</h4>
                            <p className="text-sm text-gray-500 mt-0.5">{account.accountNo}</p>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-gray-900 text-lg">₹{parseFloat(item.contribution).toFixed(2)}</div>
                            <div className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded mt-1">
                              {item.installments} installment{item.installments !== 1 ? 's' : ''}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                    {/* View More Button */}
                    {addedItems.length > 3 && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button className="w-full py-3 bg-white border-2 border-[#ad010d] text-[#ad010d] rounded-xl font-medium hover:bg-[#ad010d] hover:text-white transition-all flex items-center justify-center gap-2">
                            <Eye size={18} />
                            View All {addedItems.length} Accounts
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="max-w-2xl">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl">Report Details</AlertDialogTitle>
                            <AlertDialogDescription>
                              Complete list of accounts in this payment report
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <div className="max-h-96 overflow-auto mt-4 space-y-3 pr-2">
                            {addedItems.map((item) => {
                              const account = getAccountDetails(item.account);
                              if (!account) return null;
                              return (
                                <div key={item.account} className="flex items-start justify-between bg-gray-50 rounded-lg p-4 border border-gray-200">
                                  <div className="flex-1">
                                    <div className="font-semibold text-gray-900">{account.accountName}</div>
                                    <div className="text-sm text-gray-600 mt-1">{account.accountNo}</div>
                                    <div className="text-xs text-gray-500 mt-2 bg-white inline-block px-2 py-1 rounded">
                                      Due: {account.nextInstallmentDueDate 
                                        ? dayjs(account.nextInstallmentDueDate).format('DD-MMM-YYYY') 
                                        : account.openingDate 
                                        ? dayjs(account.openingDate).add(account.monthPaidUpTo, 'month').format('DD-MMM-YYYY') 
                                        : 'N/A'}
                                    </div>
                                  </div>
                                  <div className="text-right ml-4">
                                    <div className="font-bold text-lg text-gray-900">₹{parseFloat(item.contribution).toFixed(2)}</div>
                                    <div className="text-xs text-gray-500 mt-1 bg-white px-2 py-0.5 rounded">
                                      {item.installments} installment{item.installments !== 1 ? 's' : ''}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          <AlertDialogFooter className="mt-4">
                            <AlertDialogCancel className="bg-gray-100 hover:bg-gray-200">Close</AlertDialogCancel>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="p-5 bg-gray-50 border-t-2 border-gray-100">
                  {!isCommitted ? (
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleCancel(session._id)}
                        className="flex-1 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2 shadow-sm"
                      >
                        <X size={18} />
                        Cancel
                      </button>
                      <button
                        onClick={() => handleCommit(session._id)}
                        disabled={committing}
                        className="flex-1 py-3 bg-[#ad010d] text-white rounded-xl font-medium hover:bg-[#8d0108] transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                      >
                        <Check size={32} />
                        {committing ? 'Processing...' : 'Commit Report'}
                      </button>
                    </div>
                  ) : canRevertSession ? (
                    <div className="flex gap-3 p-2">
                      <button
                        onClick={() => handleRevert(session._id)}
                        disabled={reverting}
                        className="flex-1 px-1 py-3 bg-yellow-500 text-white rounded-xl font-medium hover:bg-yellow-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-md"
                      >
                        <Undo2  size={18} />
                        {reverting ? 'Reverting...' : 'Revert '}
                      </button>
                      <div className="flex-1 flex items-center justify-center bg-green-100 rounded-xl border-2 border-green-500">
                        <span className="inline-flex items-center gap-2 text-green-700 font-semibold">
                          <Check size={18} /> Completed
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center py-3 bg-green-100 rounded-xl border-2 border-green-500">
                      <span className="inline-flex items-center gap-2 text-green-700 font-bold text-lg">
                        <Check size={20} /> Report Completed
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#fcfbeb] rounded-tr-3xl shadow-2xl border-t-2 border-gray-200">
        <div className="grid grid-cols-3 px-6 py-4">
          <button 
            onClick={() => router.push(session?.user?.role === 'Agent' ? '/Home' : '/dashboard')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ad010d] transition-colors"
          >
            <div className="bg-gray-100 rounded-full p-3 hover:bg-gray-200 transition">
              <Home size={24} />
            </div>
            <span className="text-xs">Home</span>
          </button>

          <button className="flex flex-col items-center gap-1 text-[#ad010d] transition-colors relative">
            <div className="relative">
              <div className="bg-[#ad010d] text-white rounded-full p-3 shadow-lg">
                <NotepadTextDashed size={24} />
              </div>
            </div>
            <span className="text-xs font-medium">My Lots</span>
          </button>

          <button 
            onClick={() => router.push('/profile')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ad010d] transition-colors"
          >
            <div className="bg-gray-100 rounded-full p-3 hover:bg-gray-200 transition">
              <User size={24} />
            </div>
            <span className="text-xs">You</span>
          </button>
        </div>
      </div>
    </div>
  );
}