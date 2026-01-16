'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { World, WorldStateSchema } from '@/types';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
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
import { Loader2, Edit } from 'lucide-react';
import { toast } from 'sonner';

interface WorldDetailsDialogProps {
    worldId: string | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WorldDetailsDialog({ worldId, open, onOpenChange }: WorldDetailsDialogProps) {
    const { user } = useAuth();
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<string>('basic');
    const [world, setWorld] = useState<World | null>(null);
    const [schemas, setSchemas] = useState<WorldStateSchema[]>([]);
    const [tags, setTags] = useState<Tag[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (open && worldId && user?.user_id) {
            const fetchData = async () => {
                try {
                    setLoading(true);
                    const [worldData, schemasData, tagsData] = await Promise.all([
                        getWorldById(worldId, user.user_id),
                        getSchemaByWorldId(worldId, user.user_id),
                        getEntityTags('world', worldId, user.user_id),
                    ]);

                    if (worldData) {
                        setWorld(worldData);
                        setSchemas(schemasData);
                        setTags(tagsData);
                    } else {
                        toast.error('找不到此世界觀');
                        onOpenChange(false);
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
            // Reset state on close
            setWorld(null);
            setSchemas([]);
            setTags([]);
            setActiveTab('basic');
        }
    }, [open, worldId, user?.user_id, onOpenChange]);

    const handleEdit = () => {
        if (worldId) {
            onOpenChange(false);
            router.push(`/worlds/${worldId}/edit`);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex justify-between items-center pr-8">
                        <span className="truncate">{loading ? '載入中...' : world?.name}</span>
                        {!loading && world && (
                            <Button size="sm" variant="outline" onClick={handleEdit}>
                                <Edit className="mr-2 h-4 w-4" /> 編輯
                            </Button>
                        )}
                    </DialogTitle>
                    {!loading && world && (
                        <div className="flex flex-wrap gap-2 mt-2">
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
