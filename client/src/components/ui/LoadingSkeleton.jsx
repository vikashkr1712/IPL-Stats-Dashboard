import React from 'react';

export default function LoadingSkeleton({ count = 4, type = 'card' }) {
  if (type === 'card') {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded p-4">
            <div className="skeleton h-4 w-24 mb-4" />
            <div className="skeleton h-8 w-20 mb-2" />
            <div className="skeleton h-3 w-32" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <div className="skeleton h-5 w-40 mb-6" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (type === 'table') {
    return (
      <div className="bg-white border border-gray-200 rounded p-4">
        <div className="skeleton h-5 w-40 mb-4" />
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="skeleton h-10 w-full mb-2" />
        ))}
      </div>
    );
  }

  return null;
}
