'use client';
import React, { useState, useEffect, useRef } from 'react';
import { Search, Plus, Pencil, Building2, Home, NotepadTextDashed, User, Newspaper } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Logo from '../images/Logo.png';
import Logo_name from '../images/Logo_name.png';

interface RDAccount {
  _id: string;
  accountNo: string;
  accountName: string;
  denomination: string;
  totalDepositAmount: string;
  monthPaidUpTo: number;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const displayName =
    session?.user?.username || session?.user?.email?.split("@")[0] || "User";
  const username = session?.user?.username || "";
  // const email = session?.user?.email || "";
  const role = session?.user?.role || "";
  const [searchQuery, setSearchQuery] = useState('');
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [rdAccounts, setRdAccounts] = useState<RDAccount[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = scrollContainerRef.current?.scrollTop || 0;
      
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        // Scrolling down
        setShowHeader(false);
      } else {
        // Scrolling up
        setShowHeader(true);
      }
      
      setLastScrollY(currentScrollY);
    };

    const scrollContainer = scrollContainerRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', handleScroll);
      return () => scrollContainer.removeEventListener('scroll', handleScroll);
    }
  }, [lastScrollY]);

  // Fetch RD accounts
  useEffect(() => {
    const fetchAccounts = async () => {
      if (!session) return;
      
      setIsLoadingAccounts(true);
      try {
        const response = await fetch('/api/rd-account/display');
        const data = await response.json();
        
        if (data.ok && data.accounts) {
          setRdAccounts(data.accounts);
        }
      } catch (error) {
        console.error('Error fetching RD accounts:', error);
      } finally {
        setIsLoadingAccounts(false);
      }
    };

    fetchAccounts();
  }, [session]);

  return (
    <div className="relative flex flex-col h-screen bg-[#fcfbeb] text-gray-900">
      {/* Scrollable Content */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto"
      >
        {/* Add padding at top for header space */}
        <div className="h-24"></div>
        {/* Hero Section with Logo */}
        <div className="relative h-96 overflow-hidden">
          {/* Logo in Center */}
          <div className="absolute inset-0 flex flex-col items-center justify-center mt-9">
            {/* Logo Icon */}
            <div className="w-56 h-56 rounded-full flex items-center justify-center">
              <Image src={Logo} alt="Logo" width={180} height={180} className="object-contain" />
            </div>
            {/* Logo Name */}
            <div className="mt-3 w-56">
              <Image src={Logo_name} alt="App Name" width={300} height={80} className="object-contain" />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="px-6 mt-8">
          <div className="grid grid-cols-4 gap-4">
            {/* Add RD Account */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => router.push('/rd-account/create')}
                className="bg-[#ad010d] rounded-2xl p-6 transition-colors w-full aspect-square flex items-center justify-center text-white hover:bg-[#8d0108]"
              >
                <Plus size={32} />
              </button>
              <span className="text-sm text-center leading-tight">Add RD Account</span>
            </div>

            {/* View RD Accounts */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => router.push('/rd-account/display')}
                className="bg-[#ad010d] rounded-2xl p-6 transition-colors w-full aspect-square flex items-center justify-center text-white hover:bg-[#8d0108]"
              >
                <Building2 size={32} />
              </button>
              <span className="text-sm text-center leading-tight">View RD Accounts</span>
            </div>

            {/* Bank Transfer */}
            <div className="flex flex-col items-center gap-2">
              <button className="bg-[#ad010d] rounded-2xl p-6 transition-colors w-full aspect-square flex items-center justify-center text-white">
                <Pencil size={32} />
              </button>
              <span className="text-sm text-center leading-tight">Edit User</span>
            </div>

            {/* Create Report */}
            <div className="flex flex-col items-center gap-2">
              <button 
                onClick={() => router.push('/rd-account/report')}
                className="bg-[#ad010d] rounded-2xl p-6 transition-colors w-full aspect-square flex items-center justify-center text-white hover:bg-[#8d0108]"
              >
                <Newspaper size={32} />
              </button>
              <span className="text-sm text-center leading-tight">Create Report</span>
            </div>
          </div>
        </div>

        {/* UPI Info */}
        <div className="px-6 mt-6 flex items-center gap-4">
          <button className="flex items-center gap-2 bg-[#ad010d] border border-gray-200 rounded-full px-4 py-2 text-sm">
            <div className="w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center">
              <div className="w-2 h-2 bg-gray-100 rounded-full"></div>
            </div>
            {role ? <span className="text-gray-100">{role}</span> : <span className="text-gray-100">(no role)</span>}
          </button>
          <span className="text-sm text-gray-700">ID: {username}</span>
        </div>

        {/* People Section */}
        <div className="px-6 mt-8 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-semibold text-gray-800">RD Accounts</h2>
            {rdAccounts.length > 0 && (
              <button 
                onClick={() => router.push('/rd-account/display')}
                className="text-sm text-[#ad010d] font-medium hover:underline"
              >
                View All
              </button>
            )}
          </div>
          
          {isLoadingAccounts ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#ad010d]"></div>
            </div>
          ) : rdAccounts.length === 0 ? (
            <div className="bg-[#fcfbeb] rounded-lg p-6 text-center">
              <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-600 mb-4">No RD accounts yet</p>
              <button
                onClick={() => router.push('/rd-account/create')}
                className="bg-[#ad010d] hover:bg-[#8d0108] text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                Create Your First Account
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-4">
              {rdAccounts.slice(0, 4).map((account) => {
                  const firstWord = account.accountName?.split(' ')[0] || account.accountName || '';
                  const initial = account.accountName?.charAt(0).toUpperCase() || '';
                  return (
                    <button
                      key={account._id}
                      type="button"
                      onClick={() => router.push(`/rd-account/${account._id}`)}
                      aria-label={`Open account ${account.accountName}`}
                      className="flex flex-col items-center gap-1"
                    >
                      <div className="w-14 h-14 rounded-full bg-[#ad010d] flex items-center justify-center text-white font-bold text-lg shadow-md hover:scale-105 transition-transform">
                        {initial}
                      </div>
                      <span className="text-xs text-center text-gray-800 truncate w-16">{firstWord}</span>
                    </button>
                  );
                })}
            </div>
          )}
          
          {rdAccounts.length > 4 && (
            <button
              onClick={() => router.push('/rd-account/display')}
              className="w-full mt-4 bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium transition-colors"
            >
              View All {rdAccounts.length} Accounts
            </button>
          )}
        </div>
      </div>

      {/* Fixed Header with Search and Profile - Overlays content */}
      <div 
        className={`fixed top-0 left-0 right-0 z-50 px-6 pt-6 pb-4 bg-[#fcfbeb] transition-transform duration-300 ${
          showHeader ? 'translate-y-0' : '-translate-y-full'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Search Bar */}
          <div className="flex-1 flex items-center gap-3 bg-white/70 backdrop-blur-sm rounded-full px-4 py-3 shadow-lg">
            <Search className="text-gray-600" size={24} />
            <input
              type="text"
              placeholder="Pay friends and merchants"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => router.push('/search')}
              className="flex-1 bg-transparent text-gray-800 placeholder-gray-500 outline-none"
            />
          </div>

          {/* User Profile */}
          <div className="w-12 h-12 rounded-full bg-[#ad010d] text-white flex items-center justify-center font-bold text-xl shadow-lg">
            {displayName.charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Search handled by dedicated /search page */}

      {/* Bottom Navigation - Takes actual space, not overlaying */}
      <div className="bg-[#fcfbeb] rounded-tr-3xl shadow-lg">
        <div className="grid grid-cols-3 px-6 py-4">
          {/* Home */}
          <button className="flex flex-col items-center gap-1 text-[#ad010d] hover:text- transition-colors">
            <div className="bg-[#ad010d] hover:text- transition-colors text-white rounded-full p-3">
              <Home size={24} />
            </div>
            <span className="text-xs font-medium">Home</span>
          </button>

          {/* My Lots */}
          <button 
            onClick={() => router.push('/rd-account/confirm-report')}
            className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ad010d] transition-colors relative"
          >
            <div className="relative">
              <div className="bg-gray-100 rounded-full p-3">
                
                <NotepadTextDashed className='text-[#ad010d]' size={24} />
              </div>
             
            </div>
            <span className="text-xs">My lots</span>
          </button>

          {/* You */}
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