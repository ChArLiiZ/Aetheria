'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { World, WorldStateSchema } from '@/types';
import { getWorldById } from '@/services/supabase/worlds';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import { getEntityTags, Tag } from '@/services/supabase/tags';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Edit, Plus } from 'lucide-react';

function WorldDetailsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const worldId = params.worldId as string;

  const [activeTab, setActiveTab] = useState<string>('basic');
  const [world, setWorld] = useState<World | null>(null);
  const [schemas, setSchemas] = useState<WorldStateSchema[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  // Redirect 'new' directly to edit page
  useEffect(() => {
    if (worldId === 'new') {
      router.replace('/worlds/new/edit');
    }
  }, [worldId, router]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // 'new' 由第一個 useEffect 處理 redirect
      if (worldId === 'new') return;

      // 沒有使用者時停止 loading，避免卡住
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [worldData, schemasData, tagsData] = await Promise.all([
          getWorldById(worldId, user.user_id),
          getSchemaByWorldId(worldId, user.user_id),
          getEntityTags('world', worldId, user.user_id),
        ]);

        if (cancelled) return;

        if (!worldData) {
          toast.error('找不到此世界觀');
          router.push('/worlds');
          return;
        }

        setWorld(worldData);
        setSchemas(schemasData);
        setTags(tagsData);
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load data:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
        router.push('/worlds');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [worldId, user?.user_id, router]);

  if (loading || worldId === 'new') {
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

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-muted-foreground text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push('/worlds')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {world?.name}
              </h1>
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map(tag => (
                  <Badge key={tag.tag_id} variant="secondary">
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </div>
            <Button onClick={() => router.push(`/worlds/${worldId}/edit`)}>
              <Edit className="mr-2 h-4 w-4" /> 編輯世界觀
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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
                <CardTitle>世界描述</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap text-sm leading-relaxed">
                  {world?.description || '無描述'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>世界規則</CardTitle>
                <CardDescription>定義這個世界的運作規則</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="whitespace-pre-wrap font-mono text-sm bg-muted p-4 rounded-md">
                  {world?.rules_text || '無規則'}
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
      </main>
    </div>
  );
}

export default function WorldPage() {
  return (
    <ProtectedRoute>
      <WorldDetailsPage />
    </ProtectedRoute>
  );
}
