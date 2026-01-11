'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { World, WorldStateSchema, SchemaFieldType } from '@/types';
import { getWorldById, createWorld, updateWorld, worldNameExists } from '@/services/supabase/worlds';
import {
  getSchemaByWorldId,
  createSchemaItem,
  updateSchemaItem,
  deleteSchemaItem,
  schemaKeyExists,
} from '@/services/supabase/world-schema';
import { toast } from 'sonner';
import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Loader2, Plus, ArrowLeft, Save, Trash2, Edit } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

type Tab = 'basic' | 'states';

interface SchemaFormData {
  schema_key: string;
  display_name: string;
  type: SchemaFieldType;
  ai_description: string;
  default_value: string;
  enum_options: string[];
  list_text_items: string[];
  number_min?: number;
  number_max?: number;
  number_step?: number;
}

function WorldEditorPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const worldId = params.worldId as string;

  const [activeTab, setActiveTab] = useState<string>('basic');
  const [world, setWorld] = useState<World | null>(null);
  const [schemas, setSchemas] = useState<WorldStateSchema[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingWorld, setCreatingWorld] = useState(false);

  // Basic info form
  const [basicFormData, setBasicFormData] = useState({
    name: '',
    description: '',
    rules_text: '',
  });
  const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});
  const [savingBasic, setSavingBasic] = useState(false);

  // Schema form
  const [showSchemaForm, setShowSchemaForm] = useState(false);
  const [editingSchemaId, setEditingSchemaId] = useState<string | null>(null);
  const [schemaFormData, setSchemaFormData] = useState<SchemaFormData>({
    schema_key: '',
    display_name: '',
    type: 'text',
    ai_description: '',
    default_value: '',
    enum_options: [''],
    list_text_items: [''],
    number_min: undefined,
    number_max: undefined,
    number_step: 1,
  });
  const [schemaErrors, setSchemaErrors] = useState<Record<string, string>>({});

  // Delete confirm state
  const [schemaToDelete, setSchemaToDelete] = useState<{ id: string, name: string } | null>(null);

  const isNewWorld = worldId === 'new';

  // Load data with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      if (isNewWorld) {
        setLoading(false);
        return;
      }

      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [worldData, schemasData] = await Promise.all([
          getWorldById(worldId, user.user_id),
          getSchemaByWorldId(worldId, user.user_id),
        ]);

        if (cancelled) return;

        if (!worldData) {
          toast.error('找不到此世界觀');
          router.push('/worlds');
          return;
        }

        setWorld(worldData);
        setBasicFormData({
          name: worldData.name,
          description: worldData.description,
          rules_text: worldData.rules_text,
        });
        setSchemas(schemasData);
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
  }, [worldId, user?.user_id, isNewWorld, router]);

  const reloadData = async () => {
    if (!user?.user_id || isNewWorld) return;

    try {
      setLoading(true);
      const [worldData, schemasData] = await Promise.all([
        getWorldById(worldId, user.user_id),
        getSchemaByWorldId(worldId, user.user_id),
      ]);

      if (!worldData) {
        toast.error('找不到此世界觀');
        router.push('/worlds');
        return;
      }

      setWorld(worldData);
      setBasicFormData({
        name: worldData.name,
        description: worldData.description,
        rules_text: worldData.rules_text,
      });
      setSchemas(schemasData);
    } catch (err: any) {
      console.error('Failed to load data:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  const validateBasicForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!basicFormData.name.trim()) {
      newErrors.name = '請輸入世界觀名稱';
    } else if (user && basicFormData.name !== world?.name) {
      const exists = await worldNameExists(user.user_id, basicFormData.name.trim(), worldId);
      if (exists) {
        newErrors.name = '此世界觀名稱已存在';
      }
    }

    if (!basicFormData.description.trim()) {
      newErrors.description = '請輸入世界觀描述';
    }

    if (!basicFormData.rules_text.trim()) {
      newErrors.rules_text = '請輸入世界規則';
    }

    setBasicErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateWorld = async () => {
    if (!user) return;

    const isValid = await validateBasicForm();
    if (!isValid) {
      setActiveTab('basic');
      return;
    }

    try {
      setCreatingWorld(true);

      const newWorld = await createWorld(user.user_id, {
        name: basicFormData.name.trim(),
        description: basicFormData.description.trim(),
        rules_text: basicFormData.rules_text.trim(),
      });

      for (const schema of schemas) {
        await createSchemaItem(newWorld.world_id, user.user_id, {
          schema_key: schema.schema_key,
          display_name: schema.display_name,
          type: schema.type,
          ai_description: schema.ai_description,
          default_value_json: schema.default_value_json,
          enum_options_json: schema.enum_options_json,
          number_constraints_json: schema.number_constraints_json,
        });
      }

      toast.success(`世界觀「${newWorld.name}」建立成功！`);
      router.push('/worlds');
    } catch (err: any) {
      console.error('Failed to create world:', err);
      toast.error(`建立失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setCreatingWorld(false);
    }
  };

  const handleSaveBasic = async () => {
    if (!user) return;

    const isValid = await validateBasicForm();
    if (!isValid) return;

    try {
      setSavingBasic(true);

      await updateWorld(worldId, user.user_id, {
        name: basicFormData.name.trim(),
        description: basicFormData.description.trim(),
        rules_text: basicFormData.rules_text.trim(),
      });

      await reloadData();
      toast.success('儲存成功！');
    } catch (err: any) {
      console.error('Failed to save world:', err);
      toast.error(`更新失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingBasic(false);
    }
  };

  const resetSchemaForm = () => {
    setSchemaFormData({
      schema_key: '',
      display_name: '',
      type: 'text',
      ai_description: '',
      default_value: '',
      enum_options: [''],
      list_text_items: [''],
      number_min: undefined,
      number_max: undefined,
      number_step: 1,
    });
    setSchemaErrors({});
    setEditingSchemaId(null);
    setShowSchemaForm(false);
  };

  const handleEditSchema = (schema: WorldStateSchema) => {
    let enumOptions: string[] = [''];
    if (schema.type === 'enum' && schema.enum_options_json) {
      try {
        enumOptions = JSON.parse(schema.enum_options_json);
      } catch (e) {
        enumOptions = [''];
      }
    }

    let listTextItems: string[] = [''];
    if (schema.type === 'list_text' && schema.default_value_json) {
      try {
        listTextItems = JSON.parse(schema.default_value_json);
        if (!Array.isArray(listTextItems) || listTextItems.length === 0) {
          listTextItems = [''];
        }
      } catch (e) {
        listTextItems = [''];
      }
    }

    let numberMin, numberMax, numberStep;
    if (schema.type === 'number' && schema.number_constraints_json) {
      try {
        const constraints = JSON.parse(schema.number_constraints_json);
        numberMin = constraints.min;
        numberMax = constraints.max;
        numberStep = constraints.step || 1;
      } catch (e) { }
    }

    setSchemaFormData({
      schema_key: schema.schema_key,
      display_name: schema.display_name,
      type: schema.type,
      ai_description: schema.ai_description,
      default_value: schema.type === 'list_text' ? '' : (schema.default_value_json || ''),
      enum_options: enumOptions.length > 0 ? enumOptions : [''],
      list_text_items: listTextItems,
      number_min: numberMin,
      number_max: numberMax,
      number_step: numberStep || 1,
    });
    setEditingSchemaId(schema.schema_id);
    setShowSchemaForm(true);
  };

  const validateSchemaForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!schemaFormData.schema_key.trim()) {
      newErrors.schema_key = '請輸入狀態 Key';
    } else if (!/^[a-z_]+$/.test(schemaFormData.schema_key)) {
      newErrors.schema_key = '狀態 Key 只能包含小寫字母和底線';
    } else if (user) {
      if (isNewWorld) {
        const exists = schemas.some(
          s => s.schema_key === schemaFormData.schema_key && s.schema_id !== editingSchemaId
        );
        if (exists) {
          newErrors.schema_key = '此狀態 Key 已存在';
        }
      } else {
        const exists = await schemaKeyExists(
          worldId,
          user.user_id,
          schemaFormData.schema_key,
          editingSchemaId || undefined
        );
        if (exists) {
          newErrors.schema_key = '此狀態 Key 已存在';
        }
      }
    }

    if (!schemaFormData.display_name.trim()) {
      newErrors.display_name = '請輸入顯示名稱';
    }

    if (!schemaFormData.ai_description.trim()) {
      newErrors.ai_description = '請輸入 AI 描述';
    }

    if (schemaFormData.type === 'enum') {
      const validOptions = schemaFormData.enum_options.filter((opt) => opt.trim());
      if (validOptions.length < 2) {
        newErrors.enum_options = '至少需要兩個選項';
      }
    }

    setSchemaErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitSchema = async () => {
    if (!user) return;

    const isValid = await validateSchemaForm();
    if (!isValid) return;

    try {
      const data: any = {
        schema_key: schemaFormData.schema_key.trim(),
        display_name: schemaFormData.display_name.trim(),
        type: schemaFormData.type,
        ai_description: schemaFormData.ai_description.trim(),
        default_value_json: schemaFormData.default_value.trim(),
        enum_options_json: '',
        number_constraints_json: '',
      };

      if (schemaFormData.type === 'enum') {
        const validOptions = schemaFormData.enum_options.filter((opt) => opt.trim());
        data.enum_options_json = JSON.stringify(validOptions);
      }

      if (schemaFormData.type === 'number') {
        data.number_constraints_json = JSON.stringify({
          min: schemaFormData.number_min,
          max: schemaFormData.number_max,
          step: schemaFormData.number_step || 1,
        });
      }

      if (schemaFormData.type === 'list_text') {
        const validItems = schemaFormData.list_text_items.filter((item) => item.trim());
        data.default_value_json = JSON.stringify(validItems);
      }

      if (isNewWorld) {
        if (editingSchemaId) {
          setSchemas(schemas.map(s =>
            s.schema_id === editingSchemaId
              ? { ...s, ...data, updated_at: new Date().toISOString() }
              : s
          ));
        } else {
          const newSchema: WorldStateSchema = {
            schema_id: `temp-${Date.now()}`,
            world_id: 'temp',
            user_id: user.user_id,
            sort_order: schemas.length + 1,
            updated_at: new Date().toISOString(),
            ...data,
          };
          setSchemas([...schemas, newSchema]);
        }
      } else {
        if (editingSchemaId) {
          await updateSchemaItem(editingSchemaId, user.user_id, data);
        } else {
          await createSchemaItem(worldId, user.user_id, data);
        }
        await reloadData();
      }
      resetSchemaForm();
    } catch (err: any) {
      console.error('Failed to save schema:', err);
      toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleDeleteSchema = async () => {
    if (!user || !schemaToDelete) return;

    try {
      if (isNewWorld) {
        setSchemas(schemas.filter(s => s.schema_id !== schemaToDelete.id));
      } else {
        await deleteSchemaItem(schemaToDelete.id, user.user_id);
        await reloadData();
      }
      toast.success('已刪除狀態');
    } catch (err: any) {
      console.error('Failed to delete schema:', err);
      toast.error(`刪除失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSchemaToDelete(null);
    }
  };

  if (loading) {
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
                {isNewWorld ? '新建世界觀' : `編輯世界觀：${world?.name || ''}`}
              </h1>
              <p className="text-muted-foreground">
                {isNewWorld
                  ? '建立一個新的故事世界觀，定義世界的基本設定和狀態種類'
                  : '管理世界觀的基本設定與狀態種類'}
              </p>
            </div>
            {isNewWorld && (
              <Button onClick={handleCreateWorld} disabled={creatingWorld}>
                {creatingWorld && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                ✨ 建立世界觀
              </Button>
            )}
            {!isNewWorld && (
              <Button onClick={handleSaveBasic} disabled={savingBasic}>
                {savingBasic && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                <Save className="mr-2 h-4 w-4" /> 儲存變更
              </Button>
            )}
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
                <CardTitle>基本資訊</CardTitle>
                <CardDescription>設定世界觀的名稱、背景故事與核心規則。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="world-name">世界觀名稱</Label>
                  <Input
                    id="world-name"
                    placeholder="例如：賽博龐克 2077"
                    value={basicFormData.name}
                    onChange={(e) => setBasicFormData({ ...basicFormData, name: e.target.value })}
                  />
                  {basicErrors.name && <p className="text-sm text-destructive">{basicErrors.name}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="world-desc">世界描述</Label>
                  <Textarea
                    id="world-desc"
                    placeholder="描述這個世界的主要特徵..."
                    rows={4}
                    value={basicFormData.description}
                    onChange={(e) => setBasicFormData({ ...basicFormData, description: e.target.value })}
                  />
                  {basicErrors.description && <p className="text-sm text-destructive">{basicErrors.description}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="world-rules">世界規則</Label>
                  <Textarea
                    id="world-rules"
                    placeholder="詳細定義這個世界的運作規則..."
                    rows={8}
                    className="font-mono text-sm"
                    value={basicFormData.rules_text}
                    onChange={(e) => setBasicFormData({ ...basicFormData, rules_text: e.target.value })}
                  />
                  {basicErrors.rules_text && <p className="text-sm text-destructive">{basicErrors.rules_text}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="states" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold">狀態種類列表</h2>
              <Button onClick={() => {
                resetSchemaForm();
                setShowSchemaForm(true);
              }}>
                <Plus className="mr-2 h-4 w-4" /> 新增狀態種類
              </Button>
            </div>

            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[150px]">Key</TableHead>
                    <TableHead className="w-[150px]">名稱</TableHead>
                    <TableHead className="w-[100px]">類型</TableHead>
                    <TableHead>AI 描述</TableHead>
                    <TableHead className="w-[120px] text-right">動作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {schemas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        還沒有設定任何狀態種類
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
                        <TableCell className="text-sm text-muted-foreground max-w-md truncate">
                          {schema.ai_description}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditSchema(schema)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setSchemaToDelete({ id: schema.schema_id, name: schema.display_name })}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Schema Editor Dialog */}
        <Dialog open={showSchemaForm} onOpenChange={setShowSchemaForm}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingSchemaId ? '編輯' : '新增'}狀態種類</DialogTitle>
              <DialogDescription>
                定義角色的屬性、物品或其他狀態。
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>狀態 Key (小寫+底線)</Label>
                  <Input
                    value={schemaFormData.schema_key}
                    onChange={(e) => setSchemaFormData({ ...schemaFormData, schema_key: e.target.value.toLowerCase() })}
                    placeholder="health_points"
                    className="font-mono"
                  />
                  {schemaErrors.schema_key && <p className="text-sm text-destructive">{schemaErrors.schema_key}</p>}
                </div>
                <div className="space-y-2">
                  <Label>顯示名稱</Label>
                  <Input
                    value={schemaFormData.display_name}
                    onChange={(e) => setSchemaFormData({ ...schemaFormData, display_name: e.target.value })}
                    placeholder="生命值"
                  />
                  {schemaErrors.display_name && <p className="text-sm text-destructive">{schemaErrors.display_name}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <Label>資料類型</Label>
                <Select
                  value={schemaFormData.type}
                  onValueChange={(val: SchemaFieldType) => setSchemaFormData({ ...schemaFormData, type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">文字 (text)</SelectItem>
                    <SelectItem value="number">數字 (number)</SelectItem>
                    <SelectItem value="bool">布林 (bool)</SelectItem>
                    <SelectItem value="enum">列舉 (enum)</SelectItem>
                    <SelectItem value="list_text">文字列表 (list_text)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>AI 描述</Label>
                <Textarea
                  value={schemaFormData.ai_description}
                  onChange={(e) => setSchemaFormData({ ...schemaFormData, ai_description: e.target.value })}
                  placeholder="描述這個欄位的意義..."
                />
                {schemaErrors.ai_description && <p className="text-sm text-destructive">{schemaErrors.ai_description}</p>}
              </div>

              {/* Dynamic Fields based on Type */}
              {schemaFormData.type === 'enum' && (
                <div className="space-y-2 border p-4 rounded-md">
                  <Label>列舉選項</Label>
                  {schemaFormData.enum_options.map((opt, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...schemaFormData.enum_options];
                          newOpts[idx] = e.target.value;
                          setSchemaFormData({ ...schemaFormData, enum_options: newOpts });
                        }}
                      />
                      <Button variant="outline" size="icon" onClick={() => {
                        const newOpts = schemaFormData.enum_options.filter((_, i) => i !== idx);
                        setSchemaFormData({ ...schemaFormData, enum_options: newOpts });
                      }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" onClick={() => setSchemaFormData({ ...schemaFormData, enum_options: [...schemaFormData.enum_options, ''] })}>
                    + 新增選項
                  </Button>
                  {schemaErrors.enum_options && <p className="text-sm text-destructive">{schemaErrors.enum_options}</p>}
                </div>
              )}

              {/* Number Constraint Fields */}
              {schemaFormData.type === 'number' && (
                <div className="grid grid-cols-3 gap-2 border p-4 rounded-md">
                  <div className="space-y-1">
                    <Label>最小值</Label>
                    <Input type="number" value={schemaFormData.number_min ?? ''} onChange={(e) => setSchemaFormData({ ...schemaFormData, number_min: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                  <div className="space-y-1">
                    <Label>最大值</Label>
                    <Input type="number" value={schemaFormData.number_max ?? ''} onChange={(e) => setSchemaFormData({ ...schemaFormData, number_max: e.target.value ? Number(e.target.value) : undefined })} />
                  </div>
                  <div className="space-y-1">
                    <Label>步進</Label>
                    <Input type="number" value={schemaFormData.number_step ?? 1} onChange={(e) => setSchemaFormData({ ...schemaFormData, number_step: e.target.value ? Number(e.target.value) : 1 })} />
                  </div>
                </div>
              )}

              {schemaFormData.type !== 'list_text' && (
                <div className="space-y-2">
                  <Label>預設值</Label>
                  <Input
                    value={schemaFormData.default_value}
                    onChange={(e) => setSchemaFormData({ ...schemaFormData, default_value: e.target.value })}
                    placeholder={schemaFormData.type === 'number' ? '100' : '預設內容'}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSchemaForm(false)}>取消</Button>
              <Button onClick={handleSubmitSchema}>{editingSchemaId ? '儲存' : '新增'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Schema Alert */}
        <AlertDialog open={!!schemaToDelete} onOpenChange={(open) => !open && setSchemaToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>確定要刪除此狀態種類嗎？</AlertDialogTitle>
              <AlertDialogDescription>
                您正在刪除「{schemaToDelete?.name}」。
                此操作無法復原。
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>取消</AlertDialogCancel>
              <AlertDialogAction onClick={handleDeleteSchema} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                確認刪除
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

      </main>
    </div>
  );
}

export default function WorldEditorPage() {
  return (
    <ProtectedRoute>
      <WorldEditorPageContent />
    </ProtectedRoute>
  );
}
