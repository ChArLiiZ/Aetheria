'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { World, WorldStateSchema } from '@/types';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { getPublicWorldById, getPublicSchemaByWorldId, copyWorldToCollection } from '@/services/supabase/community';
import { getEntityTags, Tag } from '@/services/supabase/tags';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Button } from '@/components/ui/button';
import { Badge } from "@/components/ui/badge";
import { Loader2, Edit, Globe, Lock, User, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface WorldDetailsDialogProps {
    worldId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    readOnly?: boolean;
}

export function WorldDetailsDialog({ worldId, open, onOpenChange, readOnly = false }: WorldDetailsDialogProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<string>('basic');
    const [world, setWorld] = useState<World | null>(null);
    const [schemas, setSchemas] = useState<WorldStateSchema[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [creatorInfo, setCreatorInfo] = useState<{ display_name: string; avatar_url: string | null } | null>(null);
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState(false);

    useEffect(() => {
        // readOnly 模式不需要 user，可以查看公開內容
        const canFetch = open && worldId && (readOnly || user?.user_id);

        if (canFetch) {
            const fetchData = async () => {
                try {
                    setLoading(true);

                    if (readOnly) {
                        // 唯讀模式：使用公開查詢函式
                        const [publicWorld, schemasData] = await Promise.all([
                            getPublicWorldById(worldId),
                            getPublicSchemaByWorldId(worldId),
                        ]);

                        if (publicWorld) {
                            setWorld(publicWorld);
                            setSchemas(schemasData as WorldStateSchema[]);
                            // 公開查詢已包含創建者資訊
                            setCreatorInfo({
                                display_name: publicWorld.creator_name,
                                avatar_url: publicWorld.creator_avatar_url,
                            });
                            // 公開查詢已包含標籤
                            setTags(publicWorld.tags || []);
                        } else {
                            toast.error('找不到此世界觀或該世界觀非公開');
                            onOpenChange(false);
                        }
                    } else {
                        // 編輯模式：使用原本的查詢函式（需要 user_id）
                        const [worldData, schemasData, tagsData] = await Promise.all([
                            getWorldById(worldId, user!.user_id),
                            getSchemaByWorldId(worldId, user!.user_id),
                            getEntityTags('world', worldId, user!.user_id),
                        ]);

                        if (worldData) {
                            setWorld(worldData);
                            setSchemas(schemasData);
                            setTags(tagsData);
                            // 自己的世界觀，創建者就是自己
                            setCreatorInfo({
                                display_name: user!.display_name,
                                avatar_url: user!.avatar_url || null,
                            });
                        } else {
                            toast.error('找不到此世界觀');
                            onOpenChange(false);
                        }
                    }
                } catch (err: any) {
                    console.error('Failed to load world data:', err);
                    toast.error('無法載入世界觀資料');
                } finally {
                    setLoading(false);
                }
            };

            fetchData();
        } else if (!open) {
            // Reset state on close，避免舊資料殘留
            setWorld(null);
            setSchemas([]);
            setTags([]);
            setCreatorInfo(null);
            setActiveTab('basic');
        }
    }, [open, worldId, user, readOnly, onOpenChange]);

    const handleEdit = () => {
        if (worldId) {
            onOpenChange(false);
            router.push(`/worlds/${worldId}/edit`);
        }
    };

    const handleCopyToCollection = async () => {
        if (!worldId || !user?.user_id) return;

        try {
            setCopying(true);
            const newWorldId = await copyWorldToCollection(worldId, user.user_id);
            toast.success('已複製到我的收藏');
            onOpenChange(false);
            router.push(`/worlds/${newWorldId}/edit`);
        } catch (err: any) {
            console.error('Failed to copy world:', err);
            toast.error(err.message || '複製失敗');
        } finally {
            setCopying(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span className="truncate">{loading ? '載入中...' : world?.name}</span>
                        <div className="flex gap-2">
                            {!loading && world && readOnly && user && (
                                <Button size="sm" variant="outline" onClick={handleCopyToCollection} disabled={copying}>
                                    {copying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Copy className="mr-2 h-4 w-4" />}
                                    複製到收藏
                                </Button>
                            )}
                            {!loading && world && !readOnly && (
                                <Button size="sm" variant="outline" onClick={handleEdit}>
                                    <Edit className="mr-2 h-4 w-4" /> 編輯
                                </Button>
                            )}
                        </div>
                    </DialogTitle>
                    {!loading && world && (
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                            {/* 可見性 Badge */}
                            {world.visibility === 'public' ? (
                                <Badge variant="outline" className="text-green-600 border-green-600">
                                    <Globe className="h-3 w-3 mr-1" />
                                    公開
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground">
                                    <Lock className="h-3 w-3 mr-1" />
                                    私人
                                </Badge>
                            )}
                            {/* 創建者資訊 */}
                            {creatorInfo && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <span className="text-muted-foreground/60">|</span>
                                    <div className="w-5 h-5 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                        {creatorInfo.avatar_url ? (
                                            <img
                                                src={creatorInfo.avatar_url}
                                                alt={creatorInfo.display_name}
                                                className="w-full h-full object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <User className="h-3 w-3 text-muted-foreground" />
                                            </div>
                                        )}
                                    </div>
                                    <span>{creatorInfo.display_name}</span>
                                </div>
                            )}
                            {/* 原作者資訊（如果是複製的內容） */}
                            {world.original_author_id && (
                                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                    <span className="text-muted-foreground/60">|</span>
                                    <span>原作者:</span>
                                    <span className="font-medium">{world.original_author_name || '未知'}</span>
                                </div>
                            )}
                            {tags.map(tag => (
                                <Badge key={tag.tag_id} variant="secondary">
                                    {tag.name}
                                </Badge>
                            ))}
                        </div>
                    )}
                    <DialogDescription className="sr-only">
                        世界觀詳情
                    </DialogDescription>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : world ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 mt-2">
                        <TabsList>
                            <TabsTrigger value="basic">基本設定</TabsTrigger>
                            <TabsTrigger value="states">
                                狀態種類
                                <Badge variant="secondary" className="ml-2">{schemas.length}</Badge>
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            {/* 世界觀封面圖片 */}
                            {world.image_url && (
                                <div className="flex justify-center">
                                    <div className="w-40 h-40 rounded-lg overflow-hidden border bg-muted">
                                        <img
                                            src={world.image_url}
                                            alt={world.name}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                </div>
                            )}

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">世界描述</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                                        {world.description || '無描述'}
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base">世界規則</CardTitle>
                                    <CardDescription>定義這個世界的運作規則</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md overflow-x-auto">
                                        {world.rules_text || '無規則'}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>

                        <TabsContent value="states" className="space-y-4">
                            <Card>
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[150px]">Key</TableHead>
                                            <TableHead className="w-[150px]">名稱</TableHead>
                                            <TableHead className="w-[100px]">類型</TableHead>
                                            <TableHead>AI 描述</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {schemas.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                                    此世界觀尚未設定狀態種類
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            schemas.map((schema) => (
                                                <TableRow key={schema.schema_id}>
                                                    <TableCell className="font-mono text-xs">{schema.schema_key}</TableCell>
                                                    <TableCell>{schema.display_name}</TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline">{schema.type}</Badge>
                                                    </TableCell>
                                                    <TableCell className="text-sm text-muted-foreground">
                                                        {schema.ai_description}
                                                    </TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </Card>
                        </TabsContent>
                    </Tabs>
                ) : (
                    <div className="py-8 text-center text-muted-foreground">
                        無法顯示世界觀資料
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
