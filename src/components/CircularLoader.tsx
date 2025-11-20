import React from 'react';

const CircularLoader = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-[#ad010d] border-r-[#f4a84c] animate-spin"></div>
      </div>
    </div>
  );
};

export default CircularLoader;
