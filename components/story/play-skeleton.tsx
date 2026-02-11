'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function PlaySkeleton() {
  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header skeleton */}
      <div className="border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-8 rounded-md" />
        </div>
      </div>

      {/* Chat area skeleton */}
      <div className="flex-1 overflow-hidden px-4 py-6 space-y-6">
        {/* Story premise card */}
        <div className="max-w-2xl mx-auto w-full">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>

        {/* Turn skeletons */}
        {[1, 2].map((i) => (
          <div key={i} className="max-w-2xl mx-auto w-full space-y-4">
            {/* User message */}
            <div className="flex justify-end pl-12">
              <Skeleton className="h-12 w-[60%] rounded-2xl rounded-tr-sm" />
            </div>
            {/* AI response */}
            <div className="flex gap-4">
              <Skeleton className="h-8 w-8 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Input area skeleton */}
      <div className="border-t px-4 py-3">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-10 flex-1 rounded-md" />
          <Skeleton className="h-10 w-10 rounded-md" />
        </div>
      </div>
    </div>
  );
}
