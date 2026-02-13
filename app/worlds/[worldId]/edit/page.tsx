'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { World, WorldStateSchema, SchemaFieldType, Visibility, SchemaScope } from '@/types';
import { getWorldById, createWorld, updateWorld, worldNameExists } from '@/services/supabase/worlds';
import { uploadImage, deleteImage } from '@/services/supabase/storage';
import {
    getSchemaByWorldId,
    createSchemaItem,
    updateSchemaItem,
    deleteSchemaItem,
    reorderSchemaItems,
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
import { Loader2, Plus, ArrowLeft, Save, Trash2, Edit, Sparkles, ArrowUp, ArrowDown } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { AIGenerationDialog } from '@/components/ai-generation-dialog';
import { TagSelector } from '@/components/tag-selector';
import { Tag, getEntityTags, setEntityTags } from '@/services/supabase/tags';
import type { WorldGenerationOutput, SchemaGenerationData } from '@/types/api/agents';
import { ImageUpload } from '@/components/image-upload';
import { Switch } from '@/components/ui/switch';
import { Globe, Lock } from 'lucide-react';

type Tab = 'basic' | 'states';

interface SchemaFormData {
    schema_key: string;
    display_name: string;
    type: SchemaFieldType;
    scope: SchemaScope;
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

    // AI 生成對話框
    const [showAIDialog, setShowAIDialog] = useState(false);

    // Basic info form
    const [basicFormData, setBasicFormData] = useState({
        name: '',
        description: '',
        rules_text: '',
    });
    const [selectedTags, setSelectedTags] = useState<Tag[]>([]);
    const [basicErrors, setBasicErrors] = useState<Record<string, string>>({});
    const [savingBasic, setSavingBasic] = useState(false);

    // 圖片上傳狀態
    const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
    const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
    const [shouldDeleteImage, setShouldDeleteImage] = useState(false);
    const [pendingImagePreviewUrl, setPendingImagePreviewUrl] = useState<string | null>(null);

    // 可見性狀態
    const [visibility, setVisibility] = useState<Visibility>('private');

    // 管理 pendingImageFile 的 object URL 生命週期，避免記憶體洩漏
    useEffect(() => {
        if (pendingImageFile) {
            const objectUrl = URL.createObjectURL(pendingImageFile);
            setPendingImagePreviewUrl(objectUrl);
            return () => {
                URL.revokeObjectURL(objectUrl);
            };
        } else {
            setPendingImagePreviewUrl(null);
        }
    }, [pendingImageFile]);

    // Schema form
    const [showSchemaForm, setShowSchemaForm] = useState(false);
    const [editingSchemaId, setEditingSchemaId] = useState<string | null>(null);
    const [schemaFormData, setSchemaFormData] = useState<SchemaFormData>({
        schema_key: '',
        display_name: '',
        type: 'text',
        scope: 'character',
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

    // 預設的 current_time 全局 Schema（建立新世界時預填）
    const defaultCurrentTimeSchema: WorldStateSchema = {
        schema_id: 'temp-current-time',
        world_id: '',
        user_id: user?.user_id || '',
        schema_key: 'current_time',
        display_name: '當前時間',
        type: 'text' as SchemaFieldType,
        scope: 'global' as SchemaScope,
        ai_description: 'The current in-story time. Update this as time passes in the narrative (e.g., "清晨", "下午三點", "深夜").',
        default_value_json: JSON.stringify('未設定'),
        enum_options_json: '',
        number_constraints_json: '',
        sort_order: 1,
        updated_at: new Date().toISOString(),
    };

    // Load data with cancellation support to prevent race conditions
    useEffect(() => {
        let cancelled = false;

        const fetchData = async () => {
            if (isNewWorld) {
                setSchemas([defaultCurrentTimeSchema]);
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

                // 載入圖片並重置暫存狀態
                setCurrentImageUrl(worldData.image_url || null);
                setPendingImageFile(null);
                setShouldDeleteImage(false);

                // 載入標籤
                const tags = await getEntityTags('world', worldId, user.user_id);
                setSelectedTags(tags);

                // 載入可見性
                setVisibility(worldData.visibility || 'private');

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

            // 載入圖片並重置暫存狀態
            setCurrentImageUrl(worldData.image_url || null);
            setPendingImageFile(null);
            setShouldDeleteImage(false);

            // 載入標籤
            const tags = await getEntityTags('world', worldId, user.user_id);
            setSelectedTags(tags);

            // 載入可見性
            setVisibility(worldData.visibility || 'private');

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

            // 上傳圖片
            if (pendingImageFile) {
                try {
                    const imageUrl = await uploadImage('worlds', user.user_id, newWorld.world_id, pendingImageFile);
                    await updateWorld(newWorld.world_id, user.user_id, { image_url: imageUrl });
                } catch (imgErr) {
                    console.error('圖片上傳失敗:', imgErr);
                    toast.error('圖片上傳失敗，但世界觀已建立');
                }
            }

            // 設定標籤
            if (selectedTags.length > 0) {
                await setEntityTags('world', newWorld.world_id, user.user_id, selectedTags.map(t => t.tag_id));
            }

            for (const schema of schemas) {
                await createSchemaItem(newWorld.world_id, user.user_id, {
                    schema_key: schema.schema_key,
                    display_name: schema.display_name,
                    type: schema.type,
                    scope: schema.scope,
                    ai_description: schema.ai_description,
                    default_value_json: schema.default_value_json,
                    enum_options_json: schema.enum_options_json,
                    number_constraints_json: schema.number_constraints_json,
                });
            }

            toast.success(`世界觀「${newWorld.name}」建立成功！`);
            // 清除圖片相關狀態，避免導向後重複上傳
            setPendingImageFile(null);
            setShouldDeleteImage(false);
            router.push(`/worlds/${newWorld.world_id}/edit`);
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
            let finalImageUrl: string | null | undefined = undefined;

            // 處理圖片刪除
            if (shouldDeleteImage && currentImageUrl) {
                try {
                    await deleteImage('worlds', user.user_id, worldId);
                    finalImageUrl = null;
                } catch (imgErr) {
                    console.error('圖片刪除失敗:', imgErr);
                    toast.error('圖片刪除失敗，原圖片將保留');
                    // 不設定 finalImageUrl，讓 service 層保留原有值
                }
            }

            // 處理圖片上傳
            if (pendingImageFile) {
                try {
                    finalImageUrl = await uploadImage('worlds', user.user_id, worldId, pendingImageFile);
                } catch (imgErr) {
                    console.error('圖片上傳失敗:', imgErr);
                    toast.error('圖片上傳失敗');
                }
            }

            await updateWorld(worldId, user.user_id, {
                name: basicFormData.name.trim(),
                description: basicFormData.description.trim(),
                rules_text: basicFormData.rules_text.trim(),
                image_url: finalImageUrl,
                visibility: visibility,
            });

            // 更新標籤
            await setEntityTags('world', worldId, user.user_id, selectedTags.map(t => t.tag_id));

            // 儲存 AI 生成的臨時狀態（schema_id 以 temp- 開頭的）
            const tempSchemas = schemas.filter(s => s.schema_id.startsWith('temp-'));
            if (tempSchemas.length > 0) {
                for (const schema of tempSchemas) {
                    await createSchemaItem(worldId, user.user_id, {
                        schema_key: schema.schema_key,
                        display_name: schema.display_name,
                        type: schema.type,
                        scope: schema.scope,
                        ai_description: schema.ai_description,
                        default_value_json: schema.default_value_json,
                        enum_options_json: schema.enum_options_json,
                        number_constraints_json: schema.number_constraints_json,
                    });
                }
            }

            // 重新載入資料以取得新建立的 schema_id
            const updatedSchemas = await getSchemaByWorldId(worldId, user.user_id);

            // 根據當前 UI 的排序順序來重新排序
            // 建立 schema_key 到當前順序的映射
            const keyToOrder = new Map<string, number>();
            schemas.forEach((s, index) => {
                keyToOrder.set(s.schema_key, index);
            });

            // 按照 UI 順序排列新的 schema_ids
            const sortedSchemaIds = [...updatedSchemas]
                .sort((a, b) => {
                    const orderA = keyToOrder.get(a.schema_key) ?? 999;
                    const orderB = keyToOrder.get(b.schema_key) ?? 999;
                    return orderA - orderB;
                })
                .map(s => s.schema_id);

            // 更新排序
            await reorderSchemaItems(worldId, user.user_id, sortedSchemaIds);

            // 重置圖片狀態
            setPendingImageFile(null);
            setShouldDeleteImage(false);

            await reloadData();
            toast.success('儲存成功！');
        } catch (err: any) {
            console.error('Failed to save world:', err);
            toast.error(`更新失敗: ${err.message || '未知錯誤'}`);
        } finally {
            setSavingBasic(false);
        }
    };

    // 圖片變更處理
    const handleImageChange = (file: File | null) => {
        if (file) {
            setPendingImageFile(file);
            setShouldDeleteImage(false);
        } else {
            setPendingImageFile(null);
            setShouldDeleteImage(true);
        }
    };

    const resetSchemaForm = () => {
        setSchemaFormData({
            schema_key: '',
            display_name: '',
            type: 'text',
            scope: 'character',
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
            scope: schema.scope,
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
                scope: schemaFormData.scope,
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
                        schema_id: `temp-${crypto.randomUUID()}`,
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

    const handleMoveSchema = async (index: number, direction: 'up' | 'down') => {
        if (!user) return;
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === schemas.length - 1) return;

        const newSchemas = [...schemas];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;

        // Swap
        [newSchemas[index], newSchemas[targetIndex]] = [newSchemas[targetIndex], newSchemas[index]];

        // Update sort_order for all schemas
        const updatedSchemasWithOrder = newSchemas.map((s, i) => ({
            ...s,
            sort_order: i + 1
        }));

        // Optimistic update
        setSchemas(updatedSchemasWithOrder);

        // 檢查是否存在臨時狀態（尚未儲存到資料庫）
        const hasTempSchemas = newSchemas.some(s => s.schema_id.startsWith('temp-'));

        if (!isNewWorld && !hasTempSchemas) {
            // 只有當所有狀態都已儲存到資料庫時，才呼叫 API 更新排序
            try {
                const orderedIds = updatedSchemasWithOrder.map(s => s.schema_id);
                await reorderSchemaItems(worldId, user.user_id, orderedIds);
            } catch (err: any) {
                console.error('Failed to reorder schemas:', err);
                toast.error('排序更新失敗，請重新整理頁面');
                // Revert on error
                reloadData();
            }
        }
        // 對於新建世界或存在未儲存的臨時狀態時，只更新本地狀態
        // 排序會在最終儲存時根據 sort_order 一併處理
    };

    // AI 生成結果處理
    const handleAIGenerated = (data: WorldGenerationOutput) => {
        // 填入基本資訊
        setBasicFormData({
            name: data.name || basicFormData.name,
            description: data.description || basicFormData.description,
            rules_text: data.rules_text || basicFormData.rules_text,
        });

        // 填入 Schemas（合併到現有 schemas 而非覆蓋）
        if (data.schemas && data.schemas.length > 0) {
            const existingSchemaKeys = new Set(schemas.map(s => s.schema_key));
            const startIndex = schemas.length;

            const newSchemas: WorldStateSchema[] = data.schemas
                .filter(s => !existingSchemaKeys.has(s.schema_key)) // 避免重複 key
                .map((s, index) => ({
                    schema_id: `temp-${crypto.randomUUID()}`,
                    world_id: isNewWorld ? 'temp' : worldId,
                    user_id: user?.user_id || '',
                    schema_key: s.schema_key,
                    display_name: s.display_name,
                    type: s.type as SchemaFieldType,
                    scope: s.scope || 'character',
                    ai_description: s.ai_description,
                    default_value_json: s.default_value || '',
                    enum_options_json: s.enum_options ? JSON.stringify(s.enum_options) : '',
                    number_constraints_json: (s.number_min !== undefined || s.number_max !== undefined)
                        ? JSON.stringify({ min: s.number_min, max: s.number_max })
                        : '',
                    sort_order: startIndex + index + 1,
                    updated_at: new Date().toISOString(),
                }));

            if (newSchemas.length > 0) {
                setSchemas([...schemas, ...newSchemas]);
            }

            // 提示跳過的重複狀態
            const skipped = data.schemas.length - newSchemas.length;
            if (skipped > 0) {
                toast.info(`已跳過 ${skipped} 個重複的狀態類型`);
            }
        }

        toast.success('AI 生成完成！請檢查並調整內容。');
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
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setShowAIDialog(true)}>
                                <Sparkles className="mr-2 h-4 w-4" />
                                AI 生成
                            </Button>
                            {isNewWorld && (
                                <Button onClick={handleCreateWorld} disabled={creatingWorld}>
                                    {creatingWorld && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    建立世界觀
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
                                {/* 基本資訊區：圖片 + 名稱 */}
                                <div className="flex flex-col sm:flex-row gap-6">
                                    {/* 世界觀圖片 */}
                                    <div className="space-y-2">
                                        <Label>世界觀封面圖片</Label>
                                        <ImageUpload
                                            imageUrl={pendingImagePreviewUrl || currentImageUrl}
                                            onImageChange={handleImageChange}
                                            isLoading={savingBasic || creatingWorld}
                                            disabled={savingBasic || creatingWorld}
                                        />
                                        <p className="text-xs text-muted-foreground max-w-[200px]">
                                            上傳世界觀的封面圖片（選填）
                                        </p>
                                    </div>

                                    {/* 世界觀名稱 */}
                                    <div className="flex-1 space-y-2">
                                        <Label htmlFor="world-name">世界觀名稱</Label>
                                        <Input
                                            id="world-name"
                                            placeholder="例如：賽博龐克 2077"
                                            value={basicFormData.name}
                                            onChange={(e) => setBasicFormData({ ...basicFormData, name: e.target.value })}
                                        />
                                        {basicErrors.name && <p className="text-sm text-destructive">{basicErrors.name}</p>}
                                    </div>
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

                                <div className="space-y-2">
                                    <Label>標籤</Label>
                                    <TagSelector
                                        tagType="world"
                                        selectedTags={selectedTags}
                                        onTagsChange={setSelectedTags}
                                        placeholder="選擇或新增標籤..."
                                    />
                                </div>

                                {/* 可見性設定 */}
                                {!isNewWorld && (
                                    <div className="space-y-2 pt-4 border-t">
                                        <div className="flex items-center justify-between">
                                            <div className="space-y-0.5">
                                                <Label className="flex items-center gap-2">
                                                    {visibility === 'public' ? (
                                                        <Globe className="h-4 w-4 text-green-500" />
                                                    ) : (
                                                        <Lock className="h-4 w-4 text-muted-foreground" />
                                                    )}
                                                    公開世界觀
                                                </Label>
                                                <p className="text-xs text-muted-foreground">
                                                    {visibility === 'public'
                                                        ? '其他玩家可以在社群中看到並使用這個世界觀'
                                                        : '僅有你可以看到和使用這個世界觀'}
                                                </p>
                                            </div>
                                            <Switch
                                                checked={visibility === 'public'}
                                                onCheckedChange={(checked) => setVisibility(checked ? 'public' : 'private')}
                                            />
                                        </div>
                                    </div>
                                )}
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
                                        <TableHead className="w-[50px]"></TableHead>
                                        <TableHead className="w-[120px]">Key</TableHead>
                                        <TableHead className="w-[100px] whitespace-nowrap">名稱</TableHead>
                                        <TableHead className="w-[80px]">範圍</TableHead>
                                        <TableHead className="w-[80px]">類型</TableHead>
                                        <TableHead className="hidden md:table-cell">AI 描述</TableHead>
                                        <TableHead className="w-[80px] text-right">動作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {schemas.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                                還沒有設定任何狀態種類
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        schemas.map((schema, index) => (
                                            <TableRow key={schema.schema_id}>
                                                <TableCell className="px-1 text-center">
                                                    <div className="flex flex-col items-center gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            disabled={index === 0}
                                                            onClick={() => handleMoveSchema(index, 'up')}
                                                            title="上移"
                                                        >
                                                            <ArrowUp className="h-4 w-4" />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6"
                                                            disabled={index === schemas.length - 1}
                                                            onClick={() => handleMoveSchema(index, 'down')}
                                                            title="下移"
                                                        >
                                                            <ArrowDown className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-mono text-xs font-medium break-all">{schema.schema_key}</TableCell>
                                                <TableCell className="whitespace-nowrap">{schema.display_name}</TableCell>
                                                <TableCell>
                                                    <Badge variant={schema.scope === 'global' ? 'default' : 'secondary'}>
                                                        {schema.scope === 'global' ? '世界' : '角色'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs px-1">{schema.type}</Badge>
                                                </TableCell>
                                                <TableCell className="text-sm text-muted-foreground max-w-md truncate hidden md:table-cell">
                                                    {schema.ai_description}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end items-center gap-1">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditSchema(schema)}>
                                                            <Edit className="h-4 w-4" />
                                                        </Button>
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setSchemaToDelete({ id: schema.schema_id, name: schema.display_name })}>
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
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
                                <Label>狀態範圍</Label>
                                <Select
                                    value={schemaFormData.scope}
                                    onValueChange={(value: SchemaScope) =>
                                        setSchemaFormData({ ...schemaFormData, scope: value })
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="character">角色狀態 (Character Scope)</SelectItem>
                                        <SelectItem value="global">世界狀態 (Global Scope)</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-muted-foreground">
                                    {schemaFormData.scope === 'character'
                                        ? '每個角色都會擁有此狀態，例如：生命值、心情'
                                        : '整個世界共用的狀態，例如：當前時間、天氣'}
                                </p>
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

                {/* AI 生成對話框 */}
                <AIGenerationDialog
                    open={showAIDialog}
                    onOpenChange={setShowAIDialog}
                    type="world"
                    currentData={{
                        name: basicFormData.name,
                        description: basicFormData.description,
                        rules_text: basicFormData.rules_text,
                        schemas: schemas.map(s => ({
                            schema_key: s.schema_key,
                            display_name: s.display_name,
                            type: s.type,
                            ai_description: s.ai_description,
                            default_value: s.default_value_json,
                            enum_options: s.enum_options_json ? JSON.parse(s.enum_options_json) : undefined,
                            number_min: s.number_constraints_json ? JSON.parse(s.number_constraints_json).min : undefined,
                            number_max: s.number_constraints_json ? JSON.parse(s.number_constraints_json).max : undefined,
                        })),
                    }}
                    onGenerated={(data) => handleAIGenerated(data as WorldGenerationOutput)}
                />

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
