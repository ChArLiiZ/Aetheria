'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { getProviderSettings } from '@/services/supabase/provider-settings';
import { generateFullStory } from '@/services/agents/generation-agent';
import { createWorld, updateWorld as updateWorldRecord } from '@/services/supabase/worlds';
import { createSchemaItem } from '@/services/supabase/world-schema';
import { createCharacter, updateCharacter as updateCharacterRecord } from '@/services/supabase/characters';
import { createStory } from '@/services/supabase/stories';
import { addStoryCharacter } from '@/services/supabase/story-characters';
import { setMultipleStateValues } from '@/services/supabase/story-state-values';
import { uploadImage } from '@/services/supabase/storage';
import {
    getTagsByType,
    getOrCreateTag,
    setEntityTags,
} from '@/services/supabase/tags';
import type {
    FullStoryGenerationOutput,
    SchemaGenerationData,
    GeneratedCharacterData,
} from '@/types/api/agents';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TagEditor } from '@/components/tag-editor';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Loader2,
    Sparkles,
    AlertCircle,
    Bot,
    Globe,
    User,
    BookOpen,
    ArrowLeft,
    Check,
    Send,
    Plus,
    Trash2,
    MessageSquare,
    Settings,
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { ImageUpload } from '@/components/image-upload';

type Step = 'input' | 'edit' | 'creating';

function GenerateStoryPageContent() {
    const { user } = useAuth();
    const router = useRouter();

    const [step, setStep] = useState<Step>('input');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // AI 供應商資訊
    const [providerInfo, setProviderInfo] = useState<{ provider: string; model: string } | null>(null);
    const [loadingSettings, setLoadingSettings] = useState(true);

    // 現有標籤
    const [existingCharacterTags, setExistingCharacterTags] = useState<string[]>([]);
    const [existingWorldTags, setExistingWorldTags] = useState<string[]>([]);
    const [existingStoryTags, setExistingStoryTags] = useState<string[]>([]);

    // 生成/編輯的資料
    const [editData, setEditData] = useState<FullStoryGenerationOutput | null>(null);

    // AI 對話輸入
    const [aiChatInput, setAiChatInput] = useState('');
    const [aiChatLoading, setAiChatLoading] = useState(false);

    // 建立進度
    const [createProgress, setCreateProgress] = useState<string>('');

    // 圖片暫存（只在前端，儲存時才上傳）
    const [worldImageFile, setWorldImageFile] = useState<File | null>(null);
    const [characterImageFiles, setCharacterImageFiles] = useState<Map<number, File>>(new Map());
    
    // 圖片預覽 URL 狀態（管理 object URL 生命週期，避免記憶體洩漏）
    const [worldImagePreviewUrl, setWorldImagePreviewUrl] = useState<string | null>(null);
    const [characterImagePreviewUrls, setCharacterImagePreviewUrls] = useState<Map<number, string>>(new Map());

    // 管理 worldImageFile 的 object URL 生命週期
    useEffect(() => {
        if (worldImageFile) {
            const objectUrl = URL.createObjectURL(worldImageFile);
            setWorldImagePreviewUrl(objectUrl);
            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        } else {
            setWorldImagePreviewUrl(null);
        }
    }, [worldImageFile]);

    // 管理 characterImageFiles 的 object URL 生命週期
    useEffect(() => {
        const newUrls = new Map<number, string>();
        characterImageFiles.forEach((file, index) => {
            newUrls.set(index, URL.createObjectURL(file));
        });
        setCharacterImagePreviewUrls(newUrls);

        return () => {
            // 清理所有舊的 object URLs
            newUrls.forEach((url) => {
                URL.revokeObjectURL(url);
            });
        };
    }, [characterImageFiles]);

    // 載入 AI 設定和現有標籤
    useEffect(() => {
        if (!user?.user_id) {
            setLoadingSettings(false);
            return;
        }

        const loadData = async () => {
            try {
                setLoadingSettings(true);

                const [allSettings, charTags, worldTags, storyTags] = await Promise.all([
                    getProviderSettings(user.user_id),
                    getTagsByType(user.user_id, 'character'),
                    getTagsByType(user.user_id, 'world'),
                    getTagsByType(user.user_id, 'story'),
                ]);

                const settings = allSettings[0];
                if (settings) {
                    setProviderInfo({
                        provider: settings.provider || 'openrouter',
                        model: settings.default_model || '未設定',
                    });
                } else {
                    setError('請先在設定頁面配置 AI 供應商和 API Key');
                }

                setExistingCharacterTags(charTags.map(t => t.name));
                setExistingWorldTags(worldTags.map(t => t.name));
                setExistingStoryTags(storyTags.map(t => t.name));
            } catch (err) {
                console.error('[GenerateStoryPage] 載入設定失敗:', err);
            } finally {
                setLoadingSettings(false);
            }
        };

        loadData();
    }, [user?.user_id]);

    // 生成完整故事
    const handleGenerate = async () => {
        if (!user?.user_id || !prompt.trim()) return;

        setLoading(true);
        setError(null);

        try {
            const allSettings = await getProviderSettings(user.user_id);
            const settings = allSettings[0];
            if (!settings || !settings.api_key) {
                throw new Error('請先在設定頁面配置 AI 供應商和 API Key');
            }

            const result = await generateFullStory(
                settings.api_key,
                settings.default_model,
                {
                    userPrompt: prompt,
                    existingCharacterTags,
                    existingWorldTags,
                    existingStoryTags,
                }
            );

            setEditData(result);
            setStep('edit');
            // 清除暫存圖片（重新生成時）
            setWorldImageFile(null);
            setCharacterImageFiles(new Map());
        } catch (err: any) {
            console.error('[GenerateStoryPage] 生成失敗:', err);
            setError(err.message || '生成失敗，請稍後再試');
        } finally {
            setLoading(false);
        }
    };

    // AI 對話修改
    const handleAiChat = async () => {
        if (!user?.user_id || !aiChatInput.trim() || !editData) return;

        setAiChatLoading(true);
        setError(null);

        try {
            const allSettings = await getProviderSettings(user.user_id);
            const settings = allSettings[0];
            if (!settings || !settings.api_key) {
                throw new Error('請先在設定頁面配置 AI 供應商和 API Key');
            }

            const result = await generateFullStory(
                settings.api_key,
                settings.default_model,
                {
                    userPrompt: aiChatInput,
                    currentData: editData,
                    existingCharacterTags,
                    existingWorldTags,
                    existingStoryTags,
                }
            );

            setEditData(result);
            setAiChatInput('');
            toast.success('AI 已更新內容');
        } catch (err: any) {
            console.error('[GenerateStoryPage] AI 修改失敗:', err);
            setError(err.message || '修改失敗，請稍後再試');
        } finally {
            setAiChatLoading(false);
        }
    };

    // 更新世界觀資料
    const updateWorld = (field: keyof FullStoryGenerationOutput['world'], value: any) => {
        if (!editData) return;
        setEditData({
            ...editData,
            world: { ...editData.world, [field]: value },
        });
    };

    // 更新 Schema
    const updateSchema = (index: number, field: keyof SchemaGenerationData, value: any) => {
        if (!editData) return;
        const newSchemas = [...editData.world.schemas];
        newSchemas[index] = { ...newSchemas[index], [field]: value };
        setEditData({
            ...editData,
            world: { ...editData.world, schemas: newSchemas },
        });
    };

    // 新增 Schema
    const addSchema = () => {
        if (!editData) return;
        const newSchema: SchemaGenerationData = {
            schema_key: 'new_field',
            display_name: '新欄位',
            type: 'number',
            ai_description: '',
            default_value: '0',
        };
        setEditData({
            ...editData,
            world: { ...editData.world, schemas: [...editData.world.schemas, newSchema] },
        });
    };

    // 刪除 Schema
    const removeSchema = (index: number) => {
        if (!editData) return;
        const newSchemas = editData.world.schemas.filter((_, i) => i !== index);
        setEditData({
            ...editData,
            world: { ...editData.world, schemas: newSchemas },
        });
    };

    // 更新角色資料
    const updateCharacter = (index: number, field: keyof GeneratedCharacterData, value: any) => {
        if (!editData) return;
        const newCharacters = [...editData.characters];
        newCharacters[index] = { ...newCharacters[index], [field]: value };
        setEditData({ ...editData, characters: newCharacters });
    };

    // 更新角色初始狀態
    const updateCharacterState = (charIndex: number, schemaKey: string, value: any) => {
        if (!editData) return;
        const newCharacters = [...editData.characters];
        newCharacters[charIndex] = {
            ...newCharacters[charIndex],
            initial_states: {
                ...newCharacters[charIndex].initial_states,
                [schemaKey]: value,
            },
        };
        setEditData({ ...editData, characters: newCharacters });
    };

    // 新增角色
    const addCharacter = () => {
        if (!editData) return;
        const newChar: GeneratedCharacterData = {
            canonical_name: '新角色',
            core_profile_text: '',
            tags: editData.story.title ? [editData.story.title] : [],
            is_player: false,
            initial_states: {},
        };
        setEditData({ ...editData, characters: [...editData.characters, newChar] });
    };

    // 刪除角色
    const removeCharacter = (index: number) => {
        if (!editData || editData.characters.length <= 1) return;
        const newCharacters = editData.characters.filter((_, i) => i !== index);
        if (!newCharacters.some(c => c.is_player)) {
            newCharacters[0].is_player = true;
        }
        setEditData({ ...editData, characters: newCharacters });
        // 清除對應的暫存圖片
        const newImageFiles = new Map(characterImageFiles);
        newImageFiles.delete(index);
        // 重新索引
        const reindexedMap = new Map<number, File>();
        newImageFiles.forEach((file, idx) => {
            if (idx > index) {
                reindexedMap.set(idx - 1, file);
            } else {
                reindexedMap.set(idx, file);
            }
        });
        setCharacterImageFiles(reindexedMap);
    };

    // 角色圖片變更
    const handleCharacterImageChange = (index: number, file: File | null) => {
        const newMap = new Map(characterImageFiles);
        if (file) {
            newMap.set(index, file);
        } else {
            newMap.delete(index);
        }
        setCharacterImageFiles(newMap);
    };

    // 設定玩家角色
    const setPlayerCharacter = (index: number) => {
        if (!editData) return;
        const newCharacters = editData.characters.map((char, i) => ({
            ...char,
            is_player: i === index,
        }));
        setEditData({ ...editData, characters: newCharacters });
    };

    // 更新故事資料
    const updateStory = (field: keyof FullStoryGenerationOutput['story'], value: any) => {
        if (!editData) return;
        setEditData({
            ...editData,
            story: { ...editData.story, [field]: value },
        });
    };

    // 建立所有資料
    const handleCreate = async () => {
        if (!user?.user_id || !editData) return;

        setCreating(true);
        setStep('creating');
        setError(null);

        try {
            // 1. 建立世界觀
            setCreateProgress('正在建立世界觀...');
            const world = await createWorld(user.user_id, {
                name: editData.world.name,
                description: editData.world.description,
                rules_text: editData.world.rules_text,
            });

            // 設定世界觀標籤
            if (editData.world.tags && editData.world.tags.length > 0) {
                const worldTagIds: string[] = [];
                for (const tagName of editData.world.tags) {
                    const tag = await getOrCreateTag(user.user_id, 'world', tagName);
                    worldTagIds.push(tag.tag_id);
                }
                await setEntityTags('world', world.world_id, user.user_id, worldTagIds);
            }

            // 上傳世界觀圖片（如果有）
            if (worldImageFile) {
                try {
                    const worldImageUrl = await uploadImage('worlds', user.user_id, world.world_id, worldImageFile);
                    await updateWorldRecord(world.world_id, user.user_id, { image_url: worldImageUrl });
                } catch (imgErr) {
                    console.error('世界觀圖片上傳失敗:', imgErr);
                }
            }

            // 2. 建立狀態 Schema
            setCreateProgress('正在建立狀態系統...');
            for (const schema of editData.world.schemas) {
                await createSchemaItem(world.world_id, user.user_id, {
                    schema_key: schema.schema_key,
                    display_name: schema.display_name,
                    type: schema.type,
                    ai_description: schema.ai_description,
                    default_value_json: schema.default_value ? JSON.stringify(schema.default_value) : '',
                    enum_options_json: schema.enum_options ? JSON.stringify(schema.enum_options) : '',
                    number_constraints_json: (schema.number_min !== undefined || schema.number_max !== undefined)
                        ? JSON.stringify({ min: schema.number_min, max: schema.number_max })
                        : '',
                });
            }

            // 3. 建立角色
            setCreateProgress('正在建立角色...');
            const characterMap = new Map<number, string>();
            for (let i = 0; i < editData.characters.length; i++) {
                const charData = editData.characters[i];
                const character = await createCharacter(user.user_id, {
                    canonical_name: charData.canonical_name,
                    core_profile_text: charData.core_profile_text,
                });
                characterMap.set(i, character.character_id);

                // 設定角色標籤
                if (charData.tags && charData.tags.length > 0) {
                    const charTagIds: string[] = [];
                    for (const tagName of charData.tags) {
                        const tag = await getOrCreateTag(user.user_id, 'character', tagName);
                        charTagIds.push(tag.tag_id);
                    }
                    await setEntityTags('character', character.character_id, user.user_id, charTagIds);
                }

                // 上傳角色圖片（如果有）
                const charImageFile = characterImageFiles.get(i);
                if (charImageFile) {
                    try {
                        const charImageUrl = await uploadImage('characters', user.user_id, character.character_id, charImageFile);
                        await updateCharacterRecord(character.character_id, user.user_id, { image_url: charImageUrl });
                    } catch (imgErr) {
                        console.error(`角色 ${charData.canonical_name} 圖片上傳失敗:`, imgErr);
                    }
                }
            }

            // 4. 找出玩家角色
            const playerIndex = editData.characters.findIndex(c => c.is_player);
            const playerCharacterId = characterMap.get(playerIndex >= 0 ? playerIndex : 0);

            // 5. 建立故事
            setCreateProgress('正在建立故事...');
            const story = await createStory(user.user_id, {
                world_id: world.world_id,
                title: editData.story.title,
                premise_text: editData.story.premise_text,
                story_mode: editData.story.story_mode,
                player_character_id: playerCharacterId,
                story_prompt: editData.story.story_prompt,
            });

            // 設定故事標籤
            if (editData.story.tags && editData.story.tags.length > 0) {
                const storyTagIds: string[] = [];
                for (const tagName of editData.story.tags) {
                    const tag = await getOrCreateTag(user.user_id, 'story', tagName);
                    storyTagIds.push(tag.tag_id);
                }
                await setEntityTags('story', story.story_id, user.user_id, storyTagIds);
            }

            // 6. 新增故事角色並設定初始狀態
            setCreateProgress('正在設定角色狀態...');
            const stateValues: Array<{
                story_id: string;
                story_character_id: string;
                schema_key: string;
                value_json: string;
            }> = [];

            for (let i = 0; i < editData.characters.length; i++) {
                const charData = editData.characters[i];
                const characterId = characterMap.get(i)!;

                const storyCharacter = await addStoryCharacter(user.user_id, {
                    story_id: story.story_id,
                    character_id: characterId,
                    is_player: charData.is_player,
                });

                if (charData.initial_states) {
                    for (const [schemaKey, value] of Object.entries(charData.initial_states)) {
                        stateValues.push({
                            story_id: story.story_id,
                            story_character_id: storyCharacter.story_character_id,
                            schema_key: schemaKey,
                            value_json: JSON.stringify(value),
                        });
                    }
                }
            }

            if (stateValues.length > 0) {
                await setMultipleStateValues(user.user_id, stateValues);
            }

            setCreateProgress('完成！');
            toast.success('故事建立成功！');

            router.push(`/stories/${story.story_id}/play`);

        } catch (err: any) {
            console.error('[GenerateStoryPage] 建立失敗:', err);
            setError(err.message || '建立失敗，請稍後再試');
            setStep('edit');
        } finally {
            setCreating(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey && !loading && prompt.trim()) {
            handleGenerate();
        }
    };

    const handleAiChatKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey && !aiChatLoading && aiChatInput.trim()) {
            handleAiChat();
        }
    };

    // 解析狀態值的輸入
    const parseStateValue = (schema: SchemaGenerationData, value: string): any => {
        switch (schema.type) {
            case 'number':
                return parseFloat(value) || 0;
            case 'bool':
                return value === 'true';
            case 'list_text':
                return value.split(',').map(s => s.trim()).filter(Boolean);
            default:
                return value;
        }
    };

    // 格式化狀態值顯示
    const formatStateValue = (value: any): string => {
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        return String(value ?? '');
    };

    if (loadingSettings) {
        return (
            <div className="min-h-screen bg-background">
                <AppHeader />
                <main className="container mx-auto px-4 py-8 flex justify-center items-center h-[calc(100vh-4rem)]">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            <AppHeader />

            <main className="container mx-auto px-4 py-8 space-y-6">
                {/* Header */}
                <div className="space-y-4">
                    <div className="flex items-center space-x-2 text-muted-foreground text-sm">
                        <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                            <ArrowLeft className="mr-2 h-4 w-4" /> 返回儀表板
                        </Button>
                    </div>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
                            <Sparkles className="h-7 w-7" />
                            AI 快速生成故事
                        </h1>
                        <p className="text-muted-foreground">
                            描述你想要的故事，AI 會自動生成世界觀、角色和故事設定
                        </p>
                    </div>
                </div>

                {/* Step: Input */}
                {step === 'input' && (
                    <Card>
                        <CardHeader>
                            <CardTitle>描述你的故事</CardTitle>
                            <CardDescription>
                                盡可能詳細地描述你想要的故事類型、背景、主角特點等
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="story-prompt">故事描述</Label>
                                <Textarea
                                    id="story-prompt"
                                    placeholder="例如：一個賽博龐克風格的偵探故事，主角是一個有義體改造的私家偵探，正在調查一連串神秘的失蹤案件。世界觀設定在 2087 年的東京，社會階層分明，企業勢力龐大..."
                                    value={prompt}
                                    onChange={(e) => setPrompt(e.target.value)}
                                    onKeyDown={handleKeyDown}
                                    rows={8}
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

                            {providerInfo && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground border rounded-md px-3 py-2 bg-muted/30">
                                    <Bot className="h-3.5 w-3.5" />
                                    <span>
                                        使用 <span className="font-medium text-foreground">{providerInfo.provider.toUpperCase()}</span>
                                        {' / '}
                                        <span className="font-medium text-foreground">{providerInfo.model}</span>
                                    </span>
                                </div>
                            )}
                        </CardContent>
                        <CardFooter className="flex justify-end gap-2 border-t pt-4">
                            <Button variant="outline" onClick={() => router.push('/dashboard')}>
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
                                        生成故事
                                    </>
                                )}
                            </Button>
                        </CardFooter>
                    </Card>
                )}

                {/* Step: Edit */}
                {step === 'edit' && editData && (
                    <>
                        {/* AI 對話區 - 置頂顯眼位置 */}
                        <Card className="border-primary/50 bg-primary/5">
                            <CardHeader className="pb-3">
                                <CardTitle className="flex items-center gap-2 text-lg">
                                    <MessageSquare className="h-5 w-5 text-primary" />
                                    AI 修改助手
                                </CardTitle>
                                <CardDescription>
                                    輸入指令讓 AI 幫你修改內容，例如：「把主角改成女性」、「增加一個反派角色」
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="flex gap-2">
                                    <Textarea
                                        placeholder="輸入修改指令... (Ctrl+Enter 送出)"
                                        value={aiChatInput}
                                        onChange={(e) => setAiChatInput(e.target.value)}
                                        onKeyDown={handleAiChatKeyDown}
                                        rows={2}
                                        disabled={aiChatLoading}
                                        className="resize-none flex-1"
                                    />
                                    <Button
                                        onClick={handleAiChat}
                                        disabled={aiChatLoading || !aiChatInput.trim()}
                                        className="self-end"
                                    >
                                        {aiChatLoading ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <Send className="h-4 w-4" />
                                        )}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Tabs defaultValue="world" className="w-full">
                            <TabsList className="grid w-full grid-cols-3">
                                <TabsTrigger value="world" className="flex items-center gap-1">
                                    <Globe className="h-4 w-4" />
                                    世界觀
                                </TabsTrigger>
                                <TabsTrigger value="characters" className="flex items-center gap-1">
                                    <User className="h-4 w-4" />
                                    角色 ({editData.characters.length})
                                </TabsTrigger>
                                <TabsTrigger value="story" className="flex items-center gap-1">
                                    <BookOpen className="h-4 w-4" />
                                    故事
                                </TabsTrigger>
                            </TabsList>

                            {/* 世界觀編輯 */}
                            <TabsContent value="world" className="space-y-6 mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>基本資料</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="world-name">世界名稱</Label>
                                                <Input
                                                    id="world-name"
                                                    value={editData.world.name}
                                                    onChange={(e) => updateWorld('name', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>世界標籤</Label>
                                                <TagEditor
                                                    tagType="world"
                                                    tags={editData.world.tags}
                                                    onTagsChange={(tags) => updateWorld('tags', tags)}
                                                    placeholder="選擇或新增標籤..."
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>世界觀圖片</Label>
                                            <ImageUpload
                                                imageUrl={worldImagePreviewUrl || undefined}
                                                onImageChange={(file) => setWorldImageFile(file)}
                                                aspectRatio={1}
                                            />
                                            <p className="text-xs text-muted-foreground">圖片將在儲存時上傳</p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="world-desc">描述</Label>
                                            <Textarea
                                                id="world-desc"
                                                value={editData.world.description}
                                                onChange={(e) => updateWorld('description', e.target.value)}
                                                rows={3}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="world-rules">世界規則</Label>
                                            <Textarea
                                                id="world-rules"
                                                value={editData.world.rules_text}
                                                onChange={(e) => updateWorld('rules_text', e.target.value)}
                                                rows={6}
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <CardTitle className="flex items-center gap-2">
                                                    <Settings className="h-5 w-5" />
                                                    狀態系統
                                                </CardTitle>
                                                <CardDescription>定義角色可擁有的屬性欄位</CardDescription>
                                            </div>
                                            <Button variant="outline" size="sm" onClick={addSchema}>
                                                <Plus className="mr-2 h-4 w-4" />
                                                新增欄位
                                            </Button>
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {editData.world.schemas.map((schema, idx) => (
                                            <div key={idx} className="border rounded-lg p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="grid gap-3 md:grid-cols-3 flex-1">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">顯示名稱</Label>
                                                            <Input
                                                                value={schema.display_name}
                                                                onChange={(e) => updateSchema(idx, 'display_name', e.target.value)}
                                                                className="h-8"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">識別碼</Label>
                                                            <Input
                                                                value={schema.schema_key}
                                                                onChange={(e) => updateSchema(idx, 'schema_key', e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                                                                className="h-8 font-mono text-sm"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">類型</Label>
                                                            <Select
                                                                value={schema.type}
                                                                onValueChange={(value) => updateSchema(idx, 'type', value)}
                                                            >
                                                                <SelectTrigger className="h-8">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="number">數值</SelectItem>
                                                                    <SelectItem value="text">文字</SelectItem>
                                                                    <SelectItem value="bool">布林值</SelectItem>
                                                                    <SelectItem value="enum">列舉</SelectItem>
                                                                    <SelectItem value="list_text">文字列表</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeSchema(idx)}
                                                        className="ml-2 text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                                <div className="grid gap-3 md:grid-cols-2">
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">AI 描述</Label>
                                                        <Input
                                                            value={schema.ai_description}
                                                            onChange={(e) => updateSchema(idx, 'ai_description', e.target.value)}
                                                            className="h-8"
                                                            placeholder="描述這個狀態的用途..."
                                                        />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">預設值</Label>
                                                        <Input
                                                            value={schema.default_value || ''}
                                                            onChange={(e) => updateSchema(idx, 'default_value', e.target.value)}
                                                            className="h-8"
                                                        />
                                                    </div>
                                                </div>
                                                {schema.type === 'number' && (
                                                    <div className="grid gap-3 md:grid-cols-2">
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">最小值</Label>
                                                            <Input
                                                                type="number"
                                                                value={schema.number_min ?? ''}
                                                                onChange={(e) => updateSchema(idx, 'number_min', e.target.value ? Number(e.target.value) : undefined)}
                                                                className="h-8"
                                                            />
                                                        </div>
                                                        <div className="space-y-1">
                                                            <Label className="text-xs text-muted-foreground">最大值</Label>
                                                            <Input
                                                                type="number"
                                                                value={schema.number_max ?? ''}
                                                                onChange={(e) => updateSchema(idx, 'number_max', e.target.value ? Number(e.target.value) : undefined)}
                                                                className="h-8"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                                {schema.type === 'enum' && (
                                                    <div className="space-y-1">
                                                        <Label className="text-xs text-muted-foreground">選項（逗號分隔）</Label>
                                                        <Input
                                                            value={(schema.enum_options || []).join(', ')}
                                                            onChange={(e) => updateSchema(idx, 'enum_options', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                                            className="h-8"
                                                            placeholder="選項1, 選項2, 選項3"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            {/* 角色編輯 */}
                            <TabsContent value="characters" className="space-y-6 mt-6">
                                {editData.characters.map((char, idx) => (
                                    <Card key={idx}>
                                        <CardHeader>
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <Input
                                                        value={char.canonical_name}
                                                        onChange={(e) => updateCharacter(idx, 'canonical_name', e.target.value)}
                                                        className="font-medium text-lg h-9 w-48"
                                                    />
                                                    {char.is_player ? (
                                                        <Badge variant="default">玩家角色</Badge>
                                                    ) : (
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => setPlayerCharacter(idx)}
                                                        >
                                                            設為玩家
                                                        </Button>
                                                    )}
                                                </div>
                                                {editData.characters.length > 1 && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => removeCharacter(idx)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </CardHeader>
                                        <CardContent className="space-y-4">
                                            <div className="space-y-2">
                                                <Label>角色標籤</Label>
                                                <TagEditor
                                                    tagType="character"
                                                    tags={char.tags}
                                                    onTagsChange={(tags) => updateCharacter(idx, 'tags', tags)}
                                                    placeholder="選擇或新增標籤..."
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label>角色圖片</Label>
                                                <ImageUpload
                                                    imageUrl={characterImagePreviewUrls.get(idx) || undefined}
                                                    onImageChange={(file) => handleCharacterImageChange(idx, file)}
                                                    aspectRatio={1}
                                                />
                                                <p className="text-xs text-muted-foreground">圖片將在儲存時上傳</p>
                                            </div>
                                            <div className="space-y-2">
                                                <Label>角色設定</Label>
                                                <Textarea
                                                    value={char.core_profile_text}
                                                    onChange={(e) => updateCharacter(idx, 'core_profile_text', e.target.value)}
                                                    rows={6}
                                                />
                                            </div>
                                            <Separator />
                                            <div className="space-y-3">
                                                <Label className="text-muted-foreground">初始狀態</Label>
                                                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                                                    {editData.world.schemas.map((schema) => (
                                                        <div key={schema.schema_key} className="space-y-1">
                                                            <Label className="text-xs">{schema.display_name}</Label>
                                                            {schema.type === 'bool' ? (
                                                                <Select
                                                                    value={String(char.initial_states[schema.schema_key] ?? false)}
                                                                    onValueChange={(value) => updateCharacterState(idx, schema.schema_key, value === 'true')}
                                                                >
                                                                    <SelectTrigger className="h-8">
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="true">是</SelectItem>
                                                                        <SelectItem value="false">否</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : schema.type === 'enum' ? (
                                                                <Select
                                                                    value={String(char.initial_states[schema.schema_key] ?? '')}
                                                                    onValueChange={(value) => updateCharacterState(idx, schema.schema_key, value)}
                                                                >
                                                                    <SelectTrigger className="h-8">
                                                                        <SelectValue placeholder="選擇..." />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        {(schema.enum_options || []).map((opt) => (
                                                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                                                        ))}
                                                                    </SelectContent>
                                                                </Select>
                                                            ) : (
                                                                <Input
                                                                    value={formatStateValue(char.initial_states[schema.schema_key])}
                                                                    onChange={(e) => updateCharacterState(idx, schema.schema_key, parseStateValue(schema, e.target.value))}
                                                                    className="h-8"
                                                                    type={schema.type === 'number' ? 'number' : 'text'}
                                                                    placeholder={schema.type === 'list_text' ? '逗號分隔...' : ''}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                <Button variant="outline" onClick={addCharacter} className="w-full">
                                    <Plus className="mr-2 h-4 w-4" />
                                    新增角色
                                </Button>
                            </TabsContent>

                            {/* 故事編輯 */}
                            <TabsContent value="story" className="space-y-6 mt-6">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>故事設定</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <div className="grid gap-4 md:grid-cols-2">
                                            <div className="space-y-2">
                                                <Label htmlFor="story-title">故事標題</Label>
                                                <Input
                                                    id="story-title"
                                                    value={editData.story.title}
                                                    onChange={(e) => updateStory('title', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label htmlFor="story-mode">故事模式</Label>
                                                <Select
                                                    value={editData.story.story_mode}
                                                    onValueChange={(value) => updateStory('story_mode', value)}
                                                >
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="PLAYER_CHARACTER">角色扮演</SelectItem>
                                                        <SelectItem value="DIRECTOR">導演模式</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label>故事標籤</Label>
                                            <TagEditor
                                                tagType="story"
                                                tags={editData.story.tags}
                                                onTagsChange={(tags) => updateStory('tags', tags)}
                                                placeholder="選擇或新增標籤..."
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="story-premise">故事前提</Label>
                                            <Textarea
                                                id="story-premise"
                                                value={editData.story.premise_text}
                                                onChange={(e) => updateStory('premise_text', e.target.value)}
                                                rows={4}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="story-prompt">AI 提示詞</Label>
                                            <Textarea
                                                id="story-prompt"
                                                value={editData.story.story_prompt}
                                                onChange={(e) => updateStory('story_prompt', e.target.value)}
                                                rows={4}
                                                className="text-muted-foreground"
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                這是給 AI 的指導，說明敘事風格和注意事項
                                            </p>
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        {/* 底部操作區 */}
                        <div className="flex justify-between items-center pt-4 border-t">
                            <Button variant="outline" onClick={() => setStep('input')} disabled={creating || aiChatLoading}>
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                重新開始
                            </Button>
                            <Button onClick={handleCreate} disabled={creating || aiChatLoading} size="lg">
                                {creating ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        建立中...
                                    </>
                                ) : (
                                    <>
                                        <Check className="mr-2 h-4 w-4" />
                                        確認建立故事
                                    </>
                                )}
                            </Button>
                        </div>
                    </>
                )}

                {/* Step: Creating */}
                {step === 'creating' && (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16 space-y-4">
                            <Loader2 className="h-16 w-16 animate-spin text-primary" />
                            <h2 className="text-xl font-semibold">正在建立故事</h2>
                            <p className="text-muted-foreground">{createProgress}</p>
                        </CardContent>
                    </Card>
                )}
            </main>
        </div>
    );
}

export default function GenerateStoryPage() {
    return (
        <ProtectedRoute>
            <GenerateStoryPageContent />
        </ProtectedRoute>
    );
}
