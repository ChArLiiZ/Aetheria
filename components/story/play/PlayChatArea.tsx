'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { BookOpen, Send, Bot, AlertCircle, Loader2 } from 'lucide-react';
import { StoryUpdateAlert } from '@/components/story-update-alert';
import { TurnCard } from '@/components/story/turn-card';

export function PlayChatArea() {
  const {
    story,
    turns,
    pendingUserInput,
    setPendingUserInput,
    submitError,
    setSubmitError,
    submitting,
    deletingTurnIndex,
    storyCharacters,
    characters,
    updateInfo,
    updateDismissed,
    chatEndRef,
    handleSubmit,
    handleRegenerate,
    handleDeleteFromTurn,
    handleDismissUpdate,
    setShowResetDialog,
    setUserInput,
  } = useStoryPlay();

  if (!story) return null;

  return (
    <ScrollArea className="flex-1 p-4 md:p-6">
      <div className="max-w-3xl mx-auto space-y-6 pb-4">
        {/* Story Update Alert */}
        {updateInfo && updateInfo.hasUpdates && !updateDismissed && (
          <StoryUpdateAlert
            updateInfo={updateInfo}
            onReset={() => setShowResetDialog(true)}
            onDismiss={handleDismissUpdate}
          />
        )}

        {/* Story Premise */}
        <Card className="bg-muted/50 border-primary/20">
          <CardContent className="p-4 md:p-6 flex gap-4">
            <div className="shrink-0 mt-1">
              <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <BookOpen className="h-4 w-4" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold">故事開始</h3>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {story.premise_text}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Turns */}
        {turns.map((turn, index) => (
          <TurnCard
            key={turn.turn_id}
            turn={turn}
            isLast={index === turns.length - 1}
            storyCharacters={storyCharacters}
            characters={characters}
            submitting={submitting}
            deletingTurnIndex={deletingTurnIndex}
            onRegenerate={handleRegenerate}
            onDeleteFromTurn={handleDeleteFromTurn}
          />
        ))}

        {/* Empty State */}
        {turns.length === 0 && !pendingUserInput && (
          <div className="text-center py-12 text-muted-foreground">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
              <Send className="h-6 w-6 opacity-50" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">開始你的冒險</h3>
            <p>在下方輸入你的第一個行動</p>
          </div>
        )}

        {/* Pending Input */}
        {pendingUserInput && (
          <div className="space-y-6">
            <div className="flex justify-end pl-12">
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-full md:max-w-[85%] shadow-sm opacity-70">
                <p className="whitespace-pre-wrap leading-relaxed">{pendingUserInput}</p>
              </div>
            </div>

            <div className="flex gap-4 pr-4">
              <div className="shrink-0 mt-1">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                  {submitError ? (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  ) : (
                    <Bot className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </div>
              <div className="space-y-2 flex-1">
                {submitError ? (
                  <Alert variant="destructive">
                    <AlertTitle>AI 回應失敗</AlertTitle>
                    <AlertDescription>{submitError}</AlertDescription>
                    <div className="flex gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setUserInput(pendingUserInput);
                          setPendingUserInput(null);
                          setSubmitError(null);
                        }}
                      >
                        編輯後重試
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setSubmitError(null);
                          handleSubmit();
                        }}
                      >
                        重試
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setPendingUserInput(null);
                          setSubmitError(null);
                        }}
                      >
                        取消
                      </Button>
                    </div>
                  </Alert>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">AI 正在思考...</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={chatEndRef} />
      </div>
    </ScrollArea>
  );
}
