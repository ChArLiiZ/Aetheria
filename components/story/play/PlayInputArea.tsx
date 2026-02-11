'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, Lightbulb } from 'lucide-react';
import { PROVIDER_INFO } from '@/lib/ai-providers';

export function PlayInputArea() {
  const {
    userInput,
    setUserInput,
    submitting,
    suggestions,
    loadingSuggestions,
    textareaRef,
    tempProvider,
    tempUsePreset,
    tempModel,
    tempCustomModel,
    tempContextTurns,
    handleSubmit,
    handleKeyDown,
    handleGenerateSuggestions,
    handleSelectSuggestion,
  } = useStoryPlay();

  return (
    <div className="flex-none p-4 bg-background border-t">
      <div className="max-w-3xl mx-auto relative space-y-2">
        {/* Suggestions Display */}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSelectSuggestion(suggestion)}
                className="text-left px-3 py-2 text-sm bg-muted hover:bg-muted/80 border rounded-lg transition-colors max-w-full"
              >
                <span className="line-clamp-2">{suggestion}</span>
              </button>
            ))}
          </div>
        )}

        {/* Input Form */}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 p-2 border rounded-xl bg-muted/30 focus-within:ring-2 focus-within:ring-ring focus-within:border-primary"
        >
          {/* Suggestion Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handleGenerateSuggestions}
            disabled={loadingSuggestions || submitting}
            className="mb-0.5 shrink-0"
            title="生成行動建議"
          >
            {loadingSuggestions ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lightbulb className="h-4 w-4" />
            )}
          </Button>

          <Textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="輸入你的行動... (Shift+Enter 換行)"
            className="min-h-[44px] max-h-[200px] w-full resize-none border-0 bg-transparent focus-visible:ring-0 px-2 py-2.5"
            disabled={submitting}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!userInput.trim() || submitting}
            className="mb-0.5 shrink-0"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </form>
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          {PROVIDER_INFO[tempProvider].name}:{' '}
          {tempUsePreset === 'preset' ? tempModel : tempCustomModel} | 上下文:{' '}
          {tempContextTurns} 回合
        </p>
      </div>
    </div>
  );
}
