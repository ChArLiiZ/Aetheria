'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProviderSettings } from '@/services/supabase/provider-settings';
import { generateWorld, generateCharacter } from '@/services/agents/generation-agent';
import type {
    WorldGenerationInput,
    WorldGenerationOutput,
    CharacterGenerationInput,
    CharacterGenerationOutput,
    SchemaGenerationData,
} from '@/types/api/agents';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, AlertCircle, Bot } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export type GenerationType = 'world' | 'character';

interface WorldFormData {
    name?: string;
    description?: string;
    rules_text?: string;
    schemas?: SchemaGenerationData[];
}

interface CharacterFormData {
    canonical_name?: string;
    core_profile_text?: string;
    tags?: string[];
}

interface AIGenerationDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    type: GenerationType;
    currentData: WorldFormData | CharacterFormData;
    onGenerated: (data: WorldGenerationOutput | CharacterGenerationOutput) => void;
}

const PLACEHOLDER_TEXTS: Record<GenerationType, string> = {
    world: '例如：中世紀奇幻風格的世界，有魔法學院和龍族，魔法師可以使用元素魔法...',
    character: '例如：一個冷酷的女劍士，有著神秘的過去，說話簡潔有力...',
};

const TITLE_TEXTS: Record<GenerationType, string> = {
    world: 'AI 生成世界觀',
    character: 'AI 生成角色',
};

const DESCRIPTION_TEXTS: Record<GenerationType, string> = {
    world: '描述你想要的世界觀，AI 會自動生成名稱、描述、規則和狀態系統。',
    character: '描述你想要的角色，AI 會自動生成名稱、背景故事和標籤。',
};

export function AIGenerationDialog({
    open,
    onOpenChange,
    type,
    currentData,
    onGenerated,
}: AIGenerationDialogProps) {
    const { user } = useAuth();
    const [prompt, setPrompt] = useState('');
    const [lastPrompt, setLastPrompt] = useState(''); // 記錄上次的輸入
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI 供應商和模型資訊
    const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(false);

    // 對話框開啟時載入 AI 設定
    useEffect(() => {
        if (open && user?.user_id) {
            setLoadingSettings(true);
            getProviderSettings(user.user_id)
                .then((allSettings) => {
                    const settings = allSettings[0];
                    if (settings) {
                        setProviderInfo({
                            provider: settings.provider || 'openrouter',
                            model: settings.default_model || '未設定',
                        });
                        setError(null);
                    } else {
                        setProviderInfo(null);
                        setError('請先在設定頁面配置 AI 供應商和 API Key');
                    }
                })
                .catch((err) => {
                    console.error('[AIGenerationDialog] 載入設定失敗:', err);
                    setProviderInfo(null);
                })
                .finally(() => {
                    setLoadingSettings(false);
                });
        }
    }, [open, user?.user_id]);

    const handleGenerate = async () => {
        if (!user?.user_id || !prompt.trim()) return;

        setLoading(true);
        setError(null);

        try {
            // 取得使用者的 AI 設定
            const allSettings = await getProviderSettings(user.user_id);
            const settings = allSettings[0]; // 取得第一個設定
            if (!settings || !settings.api_key) {
                throw new Error('請先在設定頁面配置 AI 供應商和 API Key');
            }

            const apiKey = settings.api_key;
            const model = settings.default_model;

            let result: WorldGenerationOutput | CharacterGenerationOutput;

            if (type === 'world') {
                const input: WorldGenerationInput = {
                    currentData: currentData as WorldFormData,
                    userPrompt: prompt,
                };
                result = await generateWorld(apiKey, model, input);
            } else {
                const input: CharacterGenerationInput = {
                    currentData: currentData as CharacterFormData,
                    userPrompt: prompt,
                };
                result = await generateCharacter(apiKey, model, input);
            }

            onGenerated(result);
            setLastPrompt(prompt); // 保存這次的輸入
            setPrompt('');
            onOpenChange(false);
        } catch (err: any) {
            console.error('[AIGenerationDialog] 生成失敗:', err);
            setError(err.message || '生成失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey && !loading && prompt.trim()) {
            handleGenerate();
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5" />
                        {TITLE_TEXTS[type]}
                    </DialogTitle>
                    <DialogDescription>
                        {DESCRIPTION_TEXTS[type]}
                        {Object.values(currentData).some(v => v && (Array.isArray(v) ? v.length > 0 : true)) && (
                            <span className="block mt-1 text-muted-foreground">
                                AI 會保留你已填入的內容，僅補充或修改你指定的部分。
                            </span>
                        )}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* 顯示上次的輸入 */}
                    {lastPrompt && (
                        <div className="space-y-2 p-3 rounded-md bg-muted/50 border">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-medium text-muted-foreground">上次輸入的內容</Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto py-1 px-2 text-xs"
                                    onClick={() => setPrompt(lastPrompt)}
                                    disabled={loading}
                                >
                                    載入
                                </Button>
                            </div>
                            <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">
                                {lastPrompt}
                            </p>
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="generation-prompt">描述你的需求</Label>
                        <Textarea
                            id="generation-prompt"
                            placeholder={PLACEHOLDER_TEXTS[type]}
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={5}
                            disabled={loading}
                            className="resize-none"
                        />
                        <p className="text-xs text-muted-foreground">
                            按 Ctrl+Enter 快速生成
                        </p>
                    </div>

                    {error && (
                        <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    {/* AI 供應商和模型資訊 */}
                    {loadingSettings ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            載入 AI 設定中...
                        </div>
                    ) : providerInfo && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                            <Bot className="h-3.5 w-3.5" />
                            <span>
                                使用 <span className="font-medium text-foreground">{providerInfo.provider.toUpperCase()}</span>
                                {' / '}
                                <span className="font-medium text-foreground">{providerInfo.model}</span>
                            </span>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                        取消
                    </Button>
                    <Button onClick={handleGenerate} disabled={loading || !prompt.trim()}>
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4" />
                                生成
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
