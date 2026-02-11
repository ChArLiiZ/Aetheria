'use client';

import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { StoryPlayProvider } from '@/contexts/StoryPlayContext';
import { PlayHeader } from '@/components/story/play/PlayHeader';
import { PlayChatArea } from '@/components/story/play/PlayChatArea';
import { PlayInputArea } from '@/components/story/play/PlayInputArea';
import { PlayDialogs } from '@/components/story/play/PlayDialogs';

function StoryPlayPageContent() {
  return (
    <StoryPlayProvider>
      <div className="flex flex-col h-screen bg-background text-foreground">
        <PlayHeader />
        <PlayChatArea />
        <PlayInputArea />
        <PlayDialogs />
      </div>
    </StoryPlayProvider>
  );
}

export default function StoryPlayPage() {
  return (
    <ProtectedRoute>
      <StoryPlayPageContent />
    </ProtectedRoute>
  );
}
