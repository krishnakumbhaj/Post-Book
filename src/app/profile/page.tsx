'use client';

import React from 'react';
import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, User, Mail, Shield, LogOut, Home } from 'lucide-react';
import { NotepadTextDashed } from 'lucide-react';
import Image from 'next/image';
import Logo from '../images/Logo.png';

export default function ProfilePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-[#fcfbeb] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#ad010d]"></div>
      </div>
    );
  }

  if (!session) {
    router.push('/sign-in');
    return null;
  }

  const displayName = session.user?.username || session.user?.email?.split('@')[0] || 'User';
  const email = session.user?.email || '';
  const role = session.user?.role || 'User';
  const userId = session.user?.id || '';

  // Determine theme color based on role
  const themeColor = role === 'Agent' ? '#ad010d' : '#f4a84c';
  const themeColorLight = role === 'Agent' ? '#8d0108' : '#e89b3c';
  const themeColorBg = role === 'Agent' ? 'bg-[#ad010d]' : 'bg-[#f4a84c]';
  const themeColorHover = role === 'Agent' ? 'hover:bg-[#8d0108]' : 'hover:bg-[#e89b3c]';
  const themeColorText = role === 'Agent' ? 'text-[#ad010d]' : 'text-[#f4a84c]';
  // const themeColorPrimary = role === 'Agent' ? '#ad010d' : '#f4a84c';

  const handleLogout = async () => {
    await signOut({ callbackUrl: '/sign-in' });
  };

  return (
    <div className="min-h-screen bg-[#fcfbeb] pb-20">
      {/* Header */}
      <div className={`${themeColorBg} text-white p-4 sticky top-0 z-40`}>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-white/10 rounded-full transition"
          >
            <ArrowLeft size={24} />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">Profile</h1>
          </div>
        </div>
      </div>

      {/* Profile Content */}
      <div className="p-4 max-w-2xl mx-auto">
        {/* Profile Card */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden mb-6">
          {/* Header Section with Avatar */}
          <div className="p-8 text-white relative" style={{background: `linear-gradient(to bottom right, ${themeColor}, ${themeColorLight})`}}>
            <div className="flex flex-col items-center">
              <div className="w-24 h-24 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-4xl font-bold mb-3 shadow-xl">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <h2 className="text-2xl font-bold">{displayName}</h2>
              <p className="text-white/80 text-sm mt-1">{email}</p>
            </div>
          </div>

          {/* Details Section */}
          <div className="p-6 space-y-4">
            {/* User ID */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-lg" style={{backgroundColor: `${themeColor}10`}}>
                <User size={20} style={{color: themeColor}} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">User ID</p>
                <p className="text-gray-900 font-mono text-sm break-all">{userId}</p>
              </div>
            </div>

            {/* Email */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-lg" style={{backgroundColor: `${themeColor}10`}}>
                <Mail size={20} style={{color: themeColor}} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Email Address</p>
                <p className="text-gray-900 break-all">{email}</p>
              </div>
            </div>

            {/* Username */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-lg" style={{backgroundColor: `${themeColor}10`}}>
                <User size={20} style={{color: themeColor}} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Username</p>
                <p className="text-gray-900">{session.user?.username || 'Not set'}</p>
              </div>
            </div>

            {/* Role */}
            <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="p-2 rounded-lg" style={{backgroundColor: `${themeColor}10`}}>
                <Shield size={20} style={{color: themeColor}} />
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-500 font-medium">Role</p>
                <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                  role === 'Agent' 
                    ? 'bg-blue-100 text-blue-800' 
                    : 'bg-green-100 text-green-800'
                }`}>
                  {role}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className={`w-full ${themeColorBg} ${themeColorHover} text-white py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-3 shadow-lg hover:shadow-xl`}
        >
          <LogOut size={20} />
          Logout
        </button>

        {/* App Info */}
        <div className="mt-8 mb-16 text-center">
          <div className="flex justify-center mb-3">
            <Image src={Logo} alt="Logo" width={60} height={60} />
          </div>
          <p className="text-sm text-gray-500">Post Book App</p>
          <p className="text-xs text-gray-400 mt-1">Department of Posts, Govt. of India</p>
          <p className="text-xs text-gray-400 mt-3">Version 1.0.0</p>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#fcfbeb] rounded-tr-3xl shadow-2xl border-t-2 border-gray-200">
        <div className="grid grid-cols-3 px-6 py-4">
          {/* Home */}
          <button 
            onClick={() => router.push(role === 'Agent' ? '/Home' : '/dashboard')}
            className={`flex flex-col items-center gap-1 text-gray-600 ${role === 'Agent' ? 'hover:text-[#ad010d]' : 'hover:text-[#f4a84c]'} transition-colors`}
          >
            <div className="bg-gray-100 rounded-full p-3 hover:bg-gray-200 transition">
              <Home size={24} />
            </div>
            <span className="text-xs">Home</span>
          </button>

          {/* My Lots (only for Agents) */}
          {role === 'Agent' ? (
            <button 
              onClick={() => router.push('/rd-account/confirm-report')}
              className="flex flex-col items-center gap-1 text-gray-600 hover:text-[#ad010d] transition-colors"
            >
              <div className="bg-gray-100 rounded-full p-3 hover:bg-gray-200 transition">
                <NotepadTextDashed size={24} />
              </div>
              <span className="text-xs">My Lots</span>
            </button>
          ) : (
            <div className="flex flex-col items-center gap-1 opacity-40">
              <div className="bg-gray-100 rounded-full p-3">
                <NotepadTextDashed size={24} />
              </div>
              <span className="text-xs">My Lots</span>
            </div>
          )}

          {/* Profile - Active */}
          <button className={`flex flex-col items-center gap-1 ${themeColorText} transition-colors relative`}>
            <div className="relative">
              <div className={`${themeColorBg} text-white rounded-full p-3 shadow-lg`}>
                <User size={24} />
              </div>
            </div>
            <span className="text-xs font-medium">You</span>
          </button>
        </div>
      </div>
    </div>
  );
}
