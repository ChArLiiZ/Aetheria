'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, AlertTriangle } from 'lucide-react';
import { WorldDetailsDialog } from '@/components/world-details-dialog';
import { CharacterDetailsDialog } from '@/components/character-details-dialog';

export function PlayDialogs() {
  const {
    turns,
    showResetDialog,
    setShowResetDialog,
    resetting,
    viewingWorldId,
    setViewingWorldId,
    viewingCharacterId,
    setViewingCharacterId,
    handleResetStory,
  } = useStoryPlay();

  return (
    <>
      {/* Reset Story Confirmation Dialog */}
      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-600" />
              確認重新開始故事
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <div className="font-semibold text-foreground">此操作將會：</div>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  <li>刪除所有 {turns.length} 個回合記錄</li>
                  <li>清除所有對話歷史</li>
                  <li>刪除所有狀態變更記錄</li>
                  <li>將角色狀態重置為預設值</li>
                </ul>
                <div className="font-semibold text-orange-600 pt-2">此操作無法復原！</div>
                <div className="text-muted-foreground">故事設定和角色將會保留。</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetStory}
              disabled={resetting}
              className="bg-orange-600 text-white hover:bg-orange-700"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  重置中...
                </>
              ) : (
                <>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  確認重新開始
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <WorldDetailsDialog
        worldId={viewingWorldId}
        open={!!viewingWorldId}
        onOpenChange={(open) => !open && setViewingWorldId(null)}
      />

      <CharacterDetailsDialog
        characterId={viewingCharacterId}
        open={!!viewingCharacterId}
        onOpenChange={(open) => !open && setViewingCharacterId(null)}
      />
    </>
  );
}
