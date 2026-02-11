'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import { PlaySettingsSheet } from './PlaySettingsSheet';
import { PlayStateSheet } from './PlayStateSheet';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Globe, FileEdit, RotateCcw, Loader2 } from 'lucide-react';

export function PlayHeader() {
  const {
    story,
    turns,
    resetting,
    storyId,
    router,
    setViewingWorldId,
    setShowResetDialog,
  } = useStoryPlay();

  if (!story) return null;

  return (
    <header className="flex-none border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 px-4 py-3 sticky top-0">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <Button variant="ghost" size="icon" onClick={() => router.push('/stories')} title="返回列表">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-lg font-bold truncate leading-tight">
              {story.title}
            </h1>
            <div className="flex items-center text-xs text-muted-foreground mt-0.5 space-x-2">
              <span>回合 {turns.length}</span>
              <span>•</span>
              <span>{story.story_mode === 'PLAYER_CHARACTER' ? '玩家角色' : '導演模式'}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {/* World Details Button */}
          <Button
            variant="outline"
            size="icon"
            title="查看世界觀設定"
            onClick={() => setViewingWorldId(story.world_id)}
          >
            <Globe className="h-4 w-4" />
          </Button>

          {/* Edit Story Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={() => router.push(`/stories/${storyId}`)}
            title="編輯故事設定"
          >
            <FileEdit className="h-4 w-4" />
          </Button>

          {/* Reset Story Button */}
          {turns.length > 0 && (
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowResetDialog(true)}
              disabled={resetting}
              title="重新開始故事"
              className="text-orange-600 hover:text-orange-600 hover:bg-orange-600/10 border-orange-600/30"
            >
              {resetting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="h-4 w-4" />
              )}
            </Button>
          )}

          {/* Settings Sheet */}
          <PlaySettingsSheet />

          {/* State Panel Sheet */}
          <PlayStateSheet />
        </div>
      </div>
    </header>
  );
}
