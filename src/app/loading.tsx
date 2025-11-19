'use client'

import React from 'react';

// Custom colors approximated from the provided image
const COLOR_RED = '#C7242B';
const COLOR_ORANGE = '#F3A75A';
const BACKGROUND_COLOR = '#FAF7EF';

const Loading: React.FC = () => {
  const animationStyles = `
    @keyframes spin-pulse {
      0% { transform: rotate(0deg) scale(0.95); opacity: 0.9; }
      50% { transform: rotate(180deg) scale(1.05); opacity: 1; }
      100% { transform: rotate(360deg) scale(0.95); opacity: 0.9; }
    }
    .animate-spin-pulse {
      animation: spin-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
  `;

  return (
    <div
      className="flex flex-col items-center justify-center min-h-screen p-4"
      style={{ backgroundColor: BACKGROUND_COLOR }}
    >
      <style>{animationStyles}</style>

      <div className="relative w-24 h-24 animate-spin-pulse">
        <div
          className="absolute w-full h-1/2 rounded-t-full left-0"
          style={{
            backgroundColor: COLOR_RED,
            top: 0,
            transform: 'translateY(1px)'
          }}
        />

        <div
          className="absolute w-full h-1/2 rounded-b-full left-0"
          style={{
            backgroundColor: COLOR_ORANGE,
            bottom: 0,
            transform: 'translateY(-1px)'
          }}
        />
      </div>

      <div className="mt-8 text-xl font-semibold text-gray-700">Processing...</div>
    </div>
  );
};

export default Loading;
