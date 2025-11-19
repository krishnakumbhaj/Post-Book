"use client";
import React from 'react';
import Image from 'next/image';
import Logo from '@/app/images/Logo.png';
import Logo_name from '@/app/images/Logo_name.png';
import { useRouter } from 'next/navigation';

export default function SimpleLanding() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="flex flex-col items-center gap-2 mb-6">
          <Image src={Logo} alt="Logo" className="w-20 h-20" />
          <Image src={Logo_name} alt="Logo name" className="w-40 h-auto" />
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Post-Book</h1>
        <p className="text-gray-600 mb-6">Simple RD account management for agents — create, report, and commit deposits.</p>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.push('/sign-in')}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-800"
          >
            Sign In
          </button>
          <button
            onClick={() => router.push('/sign-up')}
            className="px-4 py-2 bg-[#ad010d] text-white rounded-md"
          >
            Get Started
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6">Built for quick RD operations. No fluff — just actions.</p>
      </div>
    </div>
  );
}