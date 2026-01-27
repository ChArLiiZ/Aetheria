'use client';

import React, { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, Bot } from 'lucide-react';
import { StoryTurn, StoryCharacter, Character } from '@/types';

interface TurnCardProps {
    turn: StoryTurn;
    isLast: boolean;
    storyCharacters: StoryCharacter[];
    characters: Map<string, Character>;
    submitting: boolean;
    deletingTurnIndex: number | null;
    onRegenerate: (turnIndex: number, userInput: string) => void;
    onDeleteFromTurn: (turnIndex: number) => void;
}

// 角色名稱比對映射表 - 為了防止每次渲染都重新建構
const buildCharacterMap = (
    storyCharacters: StoryCharacter[],
    characters: Map<string, Character>
): Map<string, { avatar: string | null; firstChar: string }> => {
    const map = new Map<string, { avatar: string | null; firstChar: string }>();

    for (const sc of storyCharacters) {
        const char = characters.get(sc.story_character_id);
        const displayName = sc.display_name_override || char?.canonical_name;
        if (displayName) {
            map.set(displayName, {
                avatar: char?.image_url || null,
                firstChar: displayName.charAt(0),
            });
        }
        // 也加入 canonical_name 作為備用匹配
        if (char?.canonical_name && char.canonical_name !== displayName) {
            map.set(char.canonical_name, {
                avatar: char.image_url || null,
                firstChar: char.canonical_name.charAt(0),
            });
        }
    }

    return map;
};

// 提取角色名稱的純函數
const extractCharacterName = (node: any): string | null => {
    if (!node) return null;

    const getText = (n: any): string => {
        if (typeof n === 'string') return n;
        if (Array.isArray(n)) return n.map(getText).join('');
        if (n?.props?.children) return getText(n.props.children);
        return '';
    };

    const text = getText(node);
    const match = text.match(/^(?:\*\*)?([^*：:]+?)(?:\*\*)?[：:][「「"]/);
    return match ? match[1].trim() : null;
};

// Memoized 的 Markdown 組件
const MemoizedMarkdown = memo(function MemoizedMarkdown({
    content,
    characterMap,
}: {
    content: string;
    characterMap: Map<string, { avatar: string | null; firstChar: string }>;
}) {
    // useMemo 緩存 components 物件
    const components = useMemo(() => ({
        blockquote: ({ children }: { children?: React.ReactNode }) => {
            const characterName = extractCharacterName(children);
            let characterAvatar: string | null = null;
            let characterFirstChar: string | null = null;

            if (characterName) {
                const charData = characterMap.get(characterName);
                if (charData) {
                    characterAvatar = charData.avatar;
                    characterFirstChar = charData.firstChar;
                } else {
                    characterFirstChar = characterName.charAt(0);
                }
            }

            return (
                <div className="my-3 flex gap-3 items-start">
                    {characterName && (
                        <div className="shrink-0 mt-0.5">
                            {characterAvatar ? (
                                <img
                                    src={characterAvatar}
                                    alt={characterName}
                                    className="w-10 h-10 rounded-full object-cover border-2 border-primary/20"
                                />
                            ) : (
                                <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-primary font-semibold text-sm">
                                    {characterFirstChar}
                                </div>
                            )}
                        </div>
                    )}
                    <div className="flex-1 pl-4 py-2 border-l-4 border-primary bg-primary/5 dark:bg-primary/10 rounded-r-lg">
                        <div className="text-foreground [&>p]:m-0 [&>p>strong]:text-primary [&>p>strong]:font-semibold">
                            {children}
                        </div>
                    </div>
                </div>
            );
        },
    }), [characterMap]);

    return (
        <ReactMarkdown components={components}>
            {content}
        </ReactMarkdown>
    );
});

// 主要的 TurnCard 組件 - 使用 memo 避免不必要的重新渲染
export const TurnCard = memo(function TurnCard({
    turn,
    isLast,
    storyCharacters,
    characters,
    submitting,
    deletingTurnIndex,
    onRegenerate,
    onDeleteFromTurn,
}: TurnCardProps) {
    // 只在角色資料變化時重新建構映射表
    const characterMap = useMemo(
        () => buildCharacterMap(storyCharacters, characters),
        [storyCharacters, characters]
    );

    return (
        <div className="space-y-6">
            {/* User Input */}
            <div className="flex justify-end pl-12">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 max-w-full md:max-w-[85%] shadow-sm">
                    <p className="whitespace-pre-wrap leading-relaxed">{turn.user_input_text}</p>
                </div>
            </div>

            {/* AI-Response */}
            <div className="flex gap-4 pr-4">
                <div className="shrink-0 mt-1">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center border">
                        <Bot className="h-4 w-4 text-muted-foreground" />
                    </div>
                </div>
                <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground font-medium">回合 {turn.turn_index}</span>
                        <div className="flex items-center gap-2">
                            {isLast && (
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    onClick={() => onRegenerate(turn.turn_index, turn.user_input_text)}
                                    disabled={submitting || deletingTurnIndex !== null}
                                    title="重新產生 (刪除此回應並重試)"
                                >
                                    {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs text-muted-foreground hover:text-destructive p-0"
                                onClick={() => onDeleteFromTurn(turn.turn_index)}
                                disabled={deletingTurnIndex !== null || submitting}
                            >
                                {deletingTurnIndex === turn.turn_index ? '刪除中...' : '回溯至此'}
                            </Button>
                        </div>
                    </div>
                    {/* Markdown Rendered Narrative */}
                    <div className="prose dark:prose-invert max-w-none text-foreground leading-relaxed">
                        <MemoizedMarkdown
                            content={turn.narrative_text}
                            characterMap={characterMap}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
});

export default TurnCard;
