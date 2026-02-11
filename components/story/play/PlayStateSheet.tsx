'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { BookOpen, User } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PlayStateSheet() {
  const {
    showStatePanel,
    setShowStatePanel,
    storyCharacters,
    characters,
    stateValues,
    worldSchema,
    setViewingCharacterId,
  } = useStoryPlay();

  return (
    <Sheet open={showStatePanel} onOpenChange={setShowStatePanel}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2 px-4 shadow-sm">
          <BookOpen className="h-4 w-4" />
          <span>狀態</span>
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[85vw] sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 h-[100dvh]"
      >
        <div className="p-6 pb-2 shrink-0">
          <SheetHeader>
            <SheetTitle>角色狀態</SheetTitle>
          </SheetHeader>
        </div>
        <ScrollArea className="flex-1 w-full">
          <div className="p-6 pt-0 space-y-4">
            {[...storyCharacters]
              .sort((a, b) => (b.is_player ? 1 : 0) - (a.is_player ? 1 : 0))
              .map((sc) => {
                const char = characters.get(sc.story_character_id);
                if (!char) return null;
                const charStates = stateValues.filter(
                  (sv) => sv.story_character_id === sc.story_character_id
                );

                return (
                  <Card key={sc.story_character_id} className="overflow-hidden">
                    {/* Character header area */}
                    <CardHeader className="p-4 pb-3">
                      <div className="flex items-center gap-4">
                        {/* Character avatar */}
                        <button
                          className="shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 rounded-full"
                          onClick={() => setViewingCharacterId(sc.character_id)}
                        >
                          {char.image_url ? (
                            <img
                              src={char.image_url}
                              alt={sc.display_name_override || char.canonical_name}
                              className="w-14 h-14 rounded-full object-cover border-2 border-muted hover:border-primary transition-colors"
                            />
                          ) : (
                            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border-2 border-muted hover:border-primary transition-colors">
                              <User className="h-6 w-6 text-muted-foreground" />
                            </div>
                          )}
                        </button>
                        {/* Name area */}
                        <div className="flex-1 min-w-0">
                          <button
                            className="text-lg font-bold hover:text-primary transition-colors focus:outline-none truncate block"
                            onClick={() => setViewingCharacterId(sc.character_id)}
                          >
                            {sc.display_name_override || char.canonical_name}
                          </button>
                          {sc.is_player && (
                            <Badge variant="secondary" className="text-[10px] h-5 mt-1">
                              玩家角色
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                      {charStates.length > 0 ? (
                        <div className="space-y-2 text-sm">
                          {charStates
                            .sort((a, b) => {
                              const schemaA = worldSchema.find(
                                (s) => s.schema_key === a.schema_key
                              );
                              const schemaB = worldSchema.find(
                                (s) => s.schema_key === b.schema_key
                              );
                              return (schemaA?.sort_order ?? 999) - (schemaB?.sort_order ?? 999);
                            })
                            .map((sv) => {
                              const schema = worldSchema.find(
                                (s) => s.schema_key === sv.schema_key
                              );
                              if (!schema) return null;

                              let displayValue;
                              let isLongText = false;
                              try {
                                const value = JSON.parse(sv.value_json);
                                if (schema.type === 'list_text') {
                                  displayValue = Array.isArray(value)
                                    ? value.join(', ')
                                    : value;
                                  isLongText = true;
                                } else if (typeof value === 'boolean') {
                                  displayValue = value ? '是' : '否';
                                } else if (schema.type === 'text') {
                                  displayValue = String(value);
                                  isLongText = String(value).length > 20;
                                } else {
                                  displayValue = String(value);
                                }
                              } catch {
                                displayValue = sv.value_json;
                              }

                              let unit = '';
                              let maxVal: number | undefined = undefined;
                              let minVal: number | undefined = undefined;
                              let numericValue: number | undefined = undefined;

                              if (schema.type === 'number') {
                                if (schema.number_constraints_json) {
                                  try {
                                    const constraints = JSON.parse(
                                      schema.number_constraints_json
                                    );
                                    unit = constraints.unit || '';

                                    if (
                                      constraints.max !== undefined &&
                                      constraints.max !== null &&
                                      constraints.max !== ''
                                    ) {
                                      const m = Number(constraints.max);
                                      if (!isNaN(m)) maxVal = m;
                                    }

                                    if (
                                      constraints.min !== undefined &&
                                      constraints.min !== null &&
                                      constraints.min !== ''
                                    ) {
                                      const m = Number(constraints.min);
                                      if (!isNaN(m)) minVal = m;
                                    }
                                  } catch {}
                                }
                                try {
                                  const v = JSON.parse(sv.value_json);
                                  const n = Number(v);
                                  if (!isNaN(n) && v !== null && v !== '') {
                                    numericValue = n;
                                  }
                                } catch {}
                              }

                              return (
                                <div
                                  key={sv.schema_key}
                                  className="border-b last:border-0 py-2 border-muted overflow-hidden"
                                >
                                  <div
                                    className={cn(
                                      'flex gap-3',
                                      isLongText
                                        ? 'flex-col'
                                        : 'items-center justify-between'
                                    )}
                                  >
                                    <span className="text-muted-foreground shrink-0 whitespace-nowrap">
                                      {schema.display_name}
                                    </span>
                                    <span
                                      className={cn(
                                        'font-medium whitespace-pre-wrap break-words',
                                        isLongText
                                          ? 'text-foreground leading-relaxed'
                                          : 'text-right'
                                      )}
                                    >
                                      {displayValue}
                                      {unit && ` ${unit}`}
                                    </span>
                                  </div>
                                  {maxVal !== undefined &&
                                    numericValue !== undefined &&
                                    maxVal - (minVal || 0) > 0 && (
                                      <div className="mt-1.5 flex items-center gap-2">
                                        <Progress
                                          value={Math.min(
                                            100,
                                            Math.max(
                                              0,
                                              ((numericValue - (minVal || 0)) /
                                                (maxVal - (minVal || 0))) *
                                                100
                                            )
                                          )}
                                          className="h-1.5"
                                        />
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">尚無狀態</span>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
