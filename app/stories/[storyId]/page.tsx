'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import { Story, World, Character, StoryMode, StoryCharacter, WorldStateSchema, StoryStateValue } from '@/types';
import { getStoryById, createStory, updateStory, storyTitleExists } from '@/services/supabase/stories';
import { getWorldsByUserId } from '@/services/supabase/worlds';
import { getCharacters } from '@/services/supabase/characters';
import {
  getStoryCharacters,
  addStoryCharacter,
  removeStoryCharacter,
  isCharacterInStory
} from '@/services/supabase/story-characters';
import { getSchemaByWorldId } from '@/services/supabase/world-schema';
import {
  getStateValues,
  setMultipleStateValues
} from '@/services/supabase/story-state-values';
import { toast } from 'sonner';

import { AppHeader } from '@/components/app-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, ArrowLeft, Save, Plus, X, Search, ChevronLeft, ChevronRight, Play, Edit, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Pagination helper
const ITEMS_PER_PAGE = 6;

const getSchemaDefaultValue = (schema: WorldStateSchema) => {
  if (schema.default_value_json) {
    try {
      return JSON.parse(schema.default_value_json);
    } catch {
      // Fall through to type-based defaults
    }
  }

  switch (schema.type) {
    case 'number':
      return 0;
    case 'bool':
      return false;
    case 'list_text':
      return [];
    case 'enum':
    case 'text':
    default:
      return '';
  }
};

function StoryDetailPageContent() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const storyId = params.storyId as string;
  const isNewStory = storyId === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [story, setStory] = useState<Story | null>(null);
  const [worlds, setWorlds] = useState<World[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [storyCharacters, setStoryCharacters] = useState<StoryCharacter[]>([]);

  // Creation tabs (only for new story)
  const [currentTab, setCurrentTab] = useState('basic');
  const [selectedCharacterIds, setSelectedCharacterIds] = useState<string[]>([]);
  const [initialStates, setInitialStates] = useState<Record<string, Record<string, any>>>({});
  const [editingCharacterId, setEditingCharacterId] = useState<string | null>(null);
  const [creationWorldSchema, setCreationWorldSchema] = useState<WorldStateSchema[]>([]);

  // State editing
  const [editingStoryCharacter, setEditingStoryCharacter] = useState<StoryCharacter | null>(null);
  const [worldSchema, setWorldSchema] = useState<WorldStateSchema[]>([]);
  const [stateValues, setStateValues] = useState<Record<string, any>>({});
  const [savingStates, setSavingStates] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    world_id: '',
    title: '',
    premise_text: '',
    story_mode: 'PLAYER_CHARACTER' as StoryMode,
    player_character_id: '',
    story_prompt: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // World selection state
  const [worldSearch, setWorldSearch] = useState('');
  const [worldPage, setWorldPage] = useState(1);
  const [showWorldSelector, setShowWorldSelector] = useState(false);

  // Character selection state
  const [characterSearch, setCharacterSearch] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [characterPage, setCharacterPage] = useState(1);
  const [showCharacterSelector, setShowCharacterSelector] = useState(false);
  const [showAddCharacterDialog, setShowAddCharacterDialog] = useState(false);

  // Load data with cancellation support to prevent race conditions
  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      // 如果沒有 user_id，設定 loading = false 並返回
      if (!user?.user_id) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);

        // Load worlds and characters
        const [worldsData, charactersData] = await Promise.all([
          getWorldsByUserId(user.user_id),
          getCharacters(user.user_id),
        ]);

        // Check if this request was cancelled
        if (cancelled) return;

        setWorlds(worldsData);
        setCharacters(charactersData);

        // Load schema if creating new story and world is selected
        if (isNewStory && formData.world_id) {
          const schemaData = await getSchemaByWorldId(formData.world_id, user.user_id);
          if (cancelled) return;
          setCreationWorldSchema(schemaData);
        }

        // Load story if editing
        if (!isNewStory) {
          const [storyData, storyCharsData] = await Promise.all([
            getStoryById(storyId, user.user_id),
            getStoryCharacters(storyId, user.user_id),
          ]);

          if (cancelled) return;

          if (!storyData) {
            toast.error('故事不存在');
            router.push('/stories');
            return;
          }

          setStory(storyData);
          setStoryCharacters(storyCharsData);
          setFormData({
            world_id: storyData.world_id,
            title: storyData.title,
            premise_text: storyData.premise_text,
            story_mode: storyData.story_mode,
            player_character_id: storyData.player_character_id || '',
            story_prompt: storyData.story_prompt,
          });
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Failed to load data:', err);
        toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
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
  }, [user?.user_id, storyId]); // Removed form dependencies to avoid loops, only re-fetch on ID/User change or specific triggers

  // Reload data function for use after updates
  const loadData = async () => {
    if (!user?.user_id) return;

    try {
      setLoading(true);

      // Load worlds and characters
      const [worldsData, charactersData] = await Promise.all([
        getWorldsByUserId(user.user_id),
        getCharacters(user.user_id),
      ]);

      setWorlds(worldsData);
      setCharacters(charactersData);

      // Load schema if creating new story and world is selected
      if (isNewStory && formData.world_id) {
        const schemaData = await getSchemaByWorldId(formData.world_id, user.user_id);
        setCreationWorldSchema(schemaData);
      }

      // Load story if editing
      if (!isNewStory) {
        const [storyData, storyCharsData] = await Promise.all([
          getStoryById(storyId, user.user_id),
          getStoryCharacters(storyId, user.user_id),
        ]);

        if (!storyData) {
          toast.error('故事不存在');
          router.push('/stories');
          return;
        }

        setStory(storyData);
        setStoryCharacters(storyCharsData);
        setFormData({
          world_id: storyData.world_id,
          title: storyData.title,
          premise_text: storyData.premise_text,
          story_mode: storyData.story_mode,
          player_character_id: storyData.player_character_id || '',
          story_prompt: storyData.story_prompt,
        });
      }
    } catch (err: any) {
      console.error('Failed to load data:', err);
      toast.error(`載入失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setLoading(false);
    }
  };

  // Get all available tags from characters
  const allTags = useMemo(() => {
    const tagSet = new Set<string>();
    characters.forEach((char) => {
      if (char.tags_json) {
        try {
          const tags = JSON.parse(char.tags_json) as string[];
          tags.forEach((tag) => tagSet.add(tag));
        } catch { }
      }
    });
    return Array.from(tagSet).sort();
  }, [characters]);

  // Filtered worlds
  const filteredWorlds = useMemo(() => {
    return worlds.filter((world) => {
      const searchLower = worldSearch.toLowerCase();
      return (
        world.name.toLowerCase().includes(searchLower) ||
        world.description.toLowerCase().includes(searchLower)
      );
    });
  }, [worlds, worldSearch]);

  const paginatedWorlds = useMemo(() => {
    const start = (worldPage - 1) * ITEMS_PER_PAGE;
    return filteredWorlds.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredWorlds, worldPage]);

  const worldTotalPages = Math.ceil(filteredWorlds.length / ITEMS_PER_PAGE);

  // Filtered characters
  const filteredCharacters = useMemo(() => {
    return characters.filter((char) => {
      // Search filter
      const searchLower = characterSearch.toLowerCase();
      const matchesSearch =
        char.canonical_name.toLowerCase().includes(searchLower) ||
        char.core_profile_text.toLowerCase().includes(searchLower);

      // Tag filter
      if (selectedTags.length > 0) {
        try {
          const charTags = char.tags_json ? (JSON.parse(char.tags_json) as string[]) : [];
          const hasAllTags = selectedTags.every((tag) => charTags.includes(tag));
          return matchesSearch && hasAllTags;
        } catch {
          return false;
        }
      }

      return matchesSearch;
    });
  }, [characters, characterSearch, selectedTags]);

  const paginatedCharacters = useMemo(() => {
    const start = (characterPage - 1) * ITEMS_PER_PAGE;
    return filteredCharacters.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredCharacters, characterPage]);

  const characterTotalPages = Math.ceil(filteredCharacters.length / ITEMS_PER_PAGE);

  // 玩家角色查找：編輯模式下 player_character_id 是 story_character_id，需透過 storyCharacters 轉換
  const playerCharacter = useMemo(() => {
    if (isNewStory) {
      // 新建故事：直接用 character_id 查找
      return characters.find((c) => c.character_id === formData.player_character_id);
    }
    // 編輯故事：先找到對應的 storyCharacter，再找 character
    const playerStoryChar = storyCharacters.find((sc) => sc.story_character_id === formData.player_character_id);
    if (playerStoryChar) {
      return characters.find((c) => c.character_id === playerStoryChar.character_id);
    }
    return undefined;
  }, [isNewStory, characters, storyCharacters, formData.player_character_id]);

  const validateForm = async (): Promise<boolean> => {
    const newErrors: Record<string, string> = {};

    if (!formData.world_id.trim()) {
      newErrors.world_id = '請選擇世界觀';
    }

    if (!formData.title.trim()) {
      newErrors.title = '請輸入故事標題';
    } else {
      // Check for duplicate title
      const exists = await storyTitleExists(
        user!.user_id,
        formData.title.trim(),
        isNewStory ? undefined : storyId
      );
      if (exists) {
        newErrors.title = '此標題已存在，請使用不同的標題';
      }
    }

    if (!formData.premise_text.trim()) {
      newErrors.premise_text = '請輸入故事前提';
    }

    if (formData.story_mode === 'PLAYER_CHARACTER' && !formData.player_character_id) {
      newErrors.player_character_id = '玩家角色模式需要選擇一個角色';
    }

    if (!formData.story_prompt.trim()) {
      newErrors.story_prompt = '請輸入 AI 提示詞';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!user) return;

    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setSaving(true);

      if (isNewStory) {
        // Create story first without player_character_id (will update after adding characters)
        const newStory = await createStory(user.user_id, {
          world_id: formData.world_id,
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_mode: formData.story_mode,
          // Don't set player_character_id here - we need the story_character_id which we get after adding characters
          player_character_id: undefined,
          story_prompt: formData.story_prompt.trim(),
        });

        // Add selected characters to the story and get story_character_ids
        const storyCharacterResults: { characterId: string; storyCharacterId: string }[] = [];
        let playerStoryCharacterId: string | undefined;

        if (selectedCharacterIds.length > 0) {
          const storyChars = await Promise.all(
            selectedCharacterIds.map((characterId) =>
              addStoryCharacter(user.user_id, {
                story_id: newStory.story_id,
                character_id: characterId,
                is_player: characterId === formData.player_character_id,
              })
            )
          );

          // Map character_id to story_character_id
          storyChars.forEach((sc, index) => {
            const characterId = selectedCharacterIds[index];
            storyCharacterResults.push({
              characterId,
              storyCharacterId: sc.story_character_id,
            });

            // Find the player's story_character_id
            if (characterId === formData.player_character_id) {
              playerStoryCharacterId = sc.story_character_id;
            }
          });
        }

        // Update story with the correct player_character_id (which is story_character_id)
        if (formData.story_mode === 'PLAYER_CHARACTER' && playerStoryCharacterId) {
          await updateStory(newStory.story_id, user.user_id, {
            player_character_id: playerStoryCharacterId,
          });
        }

        // Set initial states for all characters
        if (storyCharacterResults.length > 0 && creationWorldSchema.length > 0) {
          const allStateValues: Array<{
            story_id: string;
            story_character_id: string;
            schema_key: string;
            value_json: string;
          }> = [];

          storyCharacterResults.forEach(({ characterId, storyCharacterId }) => {
            const charStates = initialStates[characterId] || {};
            creationWorldSchema.forEach((schema) => {
              const value = charStates[schema.schema_key] ?? getSchemaDefaultValue(schema);
              allStateValues.push({
                story_id: newStory.story_id,
                story_character_id: storyCharacterId,
                schema_key: schema.schema_key,
                value_json: JSON.stringify(value),
              });
            });
          });

          if (allStateValues.length > 0) {
            await setMultipleStateValues(user.user_id, allStateValues);
          }
        }

        toast.success('故事創建成功！');
        router.push(`/stories/${newStory.story_id}`);
      } else {
        await updateStory(storyId, user.user_id, {
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_prompt: formData.story_prompt.trim(),
        });

        toast.success('更新成功！');
        loadData();
      }
    } catch (err: any) {
      console.error('Failed to save story:', err);
      toast.error(`儲存失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
    setCharacterPage(1); // Reset to first page when filter changes
  };

  // Load schema when world is selected (for new story)
  const handleWorldSelect = async (worldId: string) => {
    setFormData({ ...formData, world_id: worldId });
    setShowWorldSelector(false);

    if (isNewStory && user) {
      try {
        const schemaData = await getSchemaByWorldId(worldId, user.user_id);
        setCreationWorldSchema(schemaData);

        // Initialize default values for all selected characters
        const newInitialStates: Record<string, Record<string, any>> = {};
        selectedCharacterIds.forEach((charId) => {
          const defaultValues: Record<string, any> = {};
          schemaData.forEach((schema) => {
            try {
              defaultValues[schema.schema_key] = getSchemaDefaultValue(schema);
            } catch {
              defaultValues[schema.schema_key] = '';
            }
          });
          newInitialStates[charId] = defaultValues;
        });
        setInitialStates(newInitialStates);
      } catch (err) {
        console.error('Failed to load schema:', err);
      }
    }
  };

  // Story character management
  const handleAddCharacter = async (characterId: string) => {
    if (!user || isNewStory) return;

    try {
      // Check if character is already in story
      const alreadyInStory = await isCharacterInStory(storyId, characterId, user.user_id);
      if (alreadyInStory) {
        toast.warning('此角色已在故事中');
        return;
      }

      await addStoryCharacter(user.user_id, {
        story_id: storyId,
        character_id: characterId,
        is_player: false,
      });

      toast.success('角色已加入故事！');
      loadData(); // Reload to get updated story characters
    } catch (err: any) {
      console.error('Failed to add character:', err);
      toast.error(`新增角色失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleRemoveCharacter = async (storyCharacterId: string, characterName: string) => {
    if (!user || isNewStory) return;

    // Use window.confirm for now as AlertDialog integration for this dynamic list is complex
    // Or we could add a state for characterToRemove
    if (!confirm(`確定要從故事中移除「${characterName}」嗎？\n\n這將同時刪除該角色的所有狀態數據。`)) {
      return;
    }

    try {
      await removeStoryCharacter(storyCharacterId, user.user_id);
      toast.success('角色已移除！');
      loadData(); // Reload to get updated story characters
    } catch (err: any) {
      console.error('Failed to remove character:', err);
      toast.error(`移除角色失敗: ${err.message || '未知錯誤'}`);
    }
  };

  // State editing functions
  const handleEditStates = async (storyChar: StoryCharacter) => {
    if (!user || !story) return;

    try {
      // Load world schema and current state values
      const [schemaData, stateData] = await Promise.all([
        getSchemaByWorldId(story.world_id, user.user_id),
        getStateValues(storyId, storyChar.story_character_id, user.user_id),
      ]);

      setWorldSchema(schemaData);
      setEditingStoryCharacter(storyChar);

      // Initialize state values
      const initialValues: Record<string, any> = {};

      // First, set default values from schema
      schemaData.forEach((schema) => {
        try {
          initialValues[schema.schema_key] = getSchemaDefaultValue(schema);
        } catch {
          initialValues[schema.schema_key] = '';
        }
      });

      // Then, override with existing state values
      stateData.forEach((state) => {
        try {
          initialValues[state.schema_key] = JSON.parse(state.value_json);
        } catch {
          initialValues[state.schema_key] = state.value_json;
        }
      });

      setStateValues(initialValues);
    } catch (err: any) {
      console.error('Failed to load states:', err);
      toast.error(`載入狀態失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleSaveStates = async () => {
    if (!user || !editingStoryCharacter) return;

    try {
      setSavingStates(true);

      // Prepare state values for saving
      const valuesToSave = worldSchema.map((schema) => ({
        story_id: storyId,
        story_character_id: editingStoryCharacter.story_character_id,
        schema_key: schema.schema_key,
        value_json: JSON.stringify(stateValues[schema.schema_key] ?? getSchemaDefaultValue(schema)),
      }));

      await setMultipleStateValues(user.user_id, valuesToSave);

      toast.success('狀態已儲存！');
      setEditingStoryCharacter(null);
    } catch (err: any) {
      console.error('Failed to save states:', err);
      toast.error(`儲存狀態失敗: ${err.message || '未知錯誤'}`);
    } finally {
      setSavingStates(false);
    }
  };

  const handleCloseStateEditor = () => {
    setEditingStoryCharacter(null);
    setStateValues({});
    setWorldSchema([]);
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

  const selectedWorld = worlds.find((w) => w.world_id === formData.world_id);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      <main className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center space-x-2 text-muted-foreground text-sm">
            <Button variant="ghost" size="sm" onClick={() => router.push('/stories')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> 返回列表
            </Button>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {isNewStory ? '創建新故事' : story?.title}
              </h1>
              <p className="text-muted-foreground">
                {isNewStory ? '設定你的互動故事' : '查看和管理故事設定'}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/stories')}>取消</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isNewStory ? '創建故事' : '儲存變更'}
              </Button>
            </div>
          </div>
        </div>

        {/* Form Content */}
        <Tabs value={currentTab} onValueChange={setCurrentTab} className="space-y-4">
          {isNewStory && (
            <TabsList>
              <TabsTrigger value="basic">基本設定</TabsTrigger>
              <TabsTrigger value="characters">
                故事角色 {selectedCharacterIds.length > 0 && <Badge variant="secondary" className="ml-2">{selectedCharacterIds.length}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="ai">AI 設定</TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>基本設定</CardTitle>
                <CardDescription>選擇世界觀並設定故事的基本資訊。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* World Selection */}
                <div className="space-y-2">
                  <Label>世界觀 *</Label>
                  {isNewStory ? (
                    <>
                      {selectedWorld ? (
                        <div className="flex items-center justify-between border rounded-lg p-4">
                          <div>
                            <h4 className="font-semibold">{selectedWorld.name}</h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">{selectedWorld.description}</p>
                          </div>
                          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                            setFormData({ ...formData, world_id: '' });
                            setWorldSearch('');
                            setWorldPage(1);
                          }}>清除</Button>
                        </div>
                      ) : (
                        <Button variant="outline" className="w-full justify-start text-muted-foreground dashed" onClick={() => setShowWorldSelector(!showWorldSelector)}>
                          <Plus className="mr-2 h-4 w-4" /> 選擇世界觀
                        </Button>
                      )}
                      {showWorldSelector && !selectedWorld && (
                        <Card className="mt-2">
                          <div className="p-4 space-y-4">
                            <div className="relative">
                              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                              <Input
                                placeholder="搜尋世界觀..."
                                className="pl-8"
                                value={worldSearch}
                                onChange={(e) => {
                                  setWorldSearch(e.target.value);
                                  setWorldPage(1);
                                }}
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {paginatedWorlds.map((world) => (
                                <div key={world.world_id}
                                  className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition"
                                  onClick={() => handleWorldSelect(world.world_id)}
                                >
                                  <h4 className="font-semibold">{world.name}</h4>
                                  <p className="text-sm text-muted-foreground line-clamp-2">{world.description}</p>
                                </div>
                              ))}
                            </div>
                            {worldTotalPages > 1 && (
                              <div className="flex justify-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setWorldPage(p => Math.max(1, p - 1))} disabled={worldPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                                <span className="py-1 text-sm">{worldPage} / {worldTotalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setWorldPage(p => Math.min(worldTotalPages, p + 1))} disabled={worldPage === worldTotalPages}><ChevronRight className="h-4 w-4" /></Button>
                              </div>
                            )}
                          </div>
                        </Card>
                      )}
                    </>
                  ) : (
                    <div className="p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-medium">{selectedWorld?.name || '未知世界觀'}</h4>
                    </div>
                  )}
                  {errors.world_id && <p className="text-sm text-destructive">{errors.world_id}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="title">故事標題 *</Label>
                  <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="給你的故事起個名字" />
                  {errors.title && <p className="text-sm text-destructive">{errors.title}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="premise">故事前提 *</Label>
                  <Textarea id="premise" value={formData.premise_text} onChange={(e) => setFormData({ ...formData, premise_text: e.target.value })} placeholder="描述故事的背景和起始狀況" rows={4} />
                  {errors.premise_text && <p className="text-sm text-destructive">{errors.premise_text}</p>}
                </div>

                {/* Story Mode */}
                {isNewStory && (
                  <div className="space-y-2">
                    <Label>遊戲模式 *</Label>
                    <RadioGroup value={formData.story_mode} onValueChange={(val) => setFormData({ ...formData, story_mode: val as StoryMode })} className="grid md:grid-cols-2 gap-4">
                      <div>
                        <RadioGroupItem value="PLAYER_CHARACTER" id="mode-pc" className="peer sr-only" />
                        <Label htmlFor="mode-pc" className="flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                          <span className="text-lg font-semibold mb-1">玩家角色模式</span>
                          <span className="text-sm text-muted-foreground font-normal">你將扮演一個特定角色，從第一人稱視角體驗故事</span>
                        </Label>
                      </div>
                      <div>
                        <RadioGroupItem value="DIRECTOR" id="mode-director" className="peer sr-only" />
                        <Label htmlFor="mode-director" className="flex flex-col items-start justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer">
                          <span className="text-lg font-semibold mb-1">導演模式</span>
                          <span className="text-sm text-muted-foreground font-normal">你將作為導演，從上帝視角控制整個故事的發展</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>
                )}

                {/* Player Character Selector */}
                {formData.story_mode === 'PLAYER_CHARACTER' && (
                  <div className="space-y-2">
                    <Label>玩家角色 *</Label>
                    {isNewStory ? (
                      <>
                        {playerCharacter ? (
                          <div className="flex items-center justify-between border rounded-lg p-4">
                            <div>
                              <h4 className="font-semibold">{playerCharacter.canonical_name}</h4>
                              <div className="flex gap-1 mt-1">
                                {playerCharacter.tags_json && JSON.parse(playerCharacter.tags_json).map((tag: string, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                                ))}
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => {
                              setFormData({ ...formData, player_character_id: '' });
                              setCharacterSearch('');
                              setCharacterPage(1);
                            }}>清除</Button>
                          </div>
                        ) : (
                          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={() => setShowCharacterSelector(!showCharacterSelector)}>
                            <Plus className="mr-2 h-4 w-4" /> 選擇玩家角色
                          </Button>
                        )}
                        {showCharacterSelector && !playerCharacter && (
                          <Card className="mt-2">
                            <div className="p-4 space-y-4">
                              <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                  placeholder="搜尋角色..."
                                  className="pl-8"
                                  value={characterSearch}
                                  onChange={(e) => {
                                    setCharacterSearch(e.target.value);
                                    setCharacterPage(1);
                                  }}
                                />
                              </div>
                              {/* Tag Filters */}
                              {allTags.length > 0 && (
                                <div className="flex flex-wrap gap-2">
                                  {allTags.map(tag => (
                                    <Badge
                                      key={tag}
                                      variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                                      className="cursor-pointer"
                                      onClick={() => toggleTag(tag)}
                                    >
                                      {tag}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {paginatedCharacters.map((char) => {
                                  const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                                  return (
                                    <div key={char.character_id}
                                      className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition"
                                      onClick={() => {
                                        setFormData({ ...formData, player_character_id: char.character_id });
                                        if (!selectedCharacterIds.includes(char.character_id)) {
                                          setSelectedCharacterIds([...selectedCharacterIds, char.character_id]);
                                          // Init states logic...
                                          if (creationWorldSchema.length > 0) {
                                            const newStates = { ...initialStates };
                                            const defaultValues: Record<string, any> = {};
                                            creationWorldSchema.forEach((schema) => {
                                              try {
                                                defaultValues[schema.schema_key] = getSchemaDefaultValue(schema);
                                              } catch {
                                                defaultValues[schema.schema_key] = '';
                                              }
                                            });
                                            newStates[char.character_id] = defaultValues;
                                            setInitialStates(newStates);
                                          }
                                        }
                                        setShowCharacterSelector(false);
                                      }}
                                    >
                                      <h4 className="font-semibold">{char.canonical_name}</h4>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {charTags.slice(0, 3).map((tag: string, i: number) => (
                                          <Badge key={i} variant="secondary" className="text-xs">{tag}</Badge>
                                        ))}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              {characterTotalPages > 1 && (
                                <div className="flex justify-center gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setCharacterPage(p => Math.max(1, p - 1))} disabled={characterPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
                                  <span className="py-1 text-sm">{characterPage} / {characterTotalPages}</span>
                                  <Button variant="outline" size="sm" onClick={() => setCharacterPage(p => Math.min(characterTotalPages, p + 1))} disabled={characterPage === characterTotalPages}><ChevronRight className="h-4 w-4" /></Button>
                                </div>
                              )}
                            </div>
                          </Card>
                        )}
                      </>
                    ) : (
                      <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-medium">{playerCharacter?.canonical_name || '未知角色'}</h4>
                      </div>
                    )}
                    {errors.player_character_id && <p className="text-sm text-destructive">{errors.player_character_id}</p>}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="characters" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>選擇故事角色</CardTitle>
                <CardDescription>選擇要加入故事的角色（可以在創建後繼續新增或移除）。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {selectedCharacterIds.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="font-medium">已選擇 ({selectedCharacterIds.length})</h4>
                    <div className="grid gap-4">
                      {selectedCharacterIds.map(charId => {
                        const char = characters.find(c => c.character_id === charId);
                        if (!char) return null;
                        const isEditing = editingCharacterId === charId;
                        const charStates = initialStates[charId] || {};

                        return (
                          <div key={charId} className="border rounded-lg overflow-hidden">
                            <div className="flex items-center justify-between p-4 bg-muted/30">
                              <div className="flex items-center gap-3">
                                <span className="font-medium">{char.canonical_name}</span>
                                {formData.player_character_id === charId && <Badge>玩家角色</Badge>}
                              </div>
                              <div className="flex gap-2">
                                {formData.world_id && creationWorldSchema.length > 0 && (
                                  <Button size="sm" variant={isEditing ? "secondary" : "outline"} onClick={() => setEditingCharacterId(isEditing ? null : charId)}>
                                    {isEditing ? '收起' : '設定狀態'}
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setSelectedCharacterIds(prev => prev.filter(id => id !== charId))}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            {isEditing && formData.world_id && (
                              <div className="p-4 border-t bg-muted/10 grid gap-4 grid-cols-1 md:grid-cols-2">
                                {creationWorldSchema.map(schema => (
                                  <div key={schema.schema_id} className="space-y-1">
                                    <Label className="text-xs text-muted-foreground">{schema.display_name}</Label>
                                    {schema.type === 'number' && (
                                      <Input type="number" className="h-8" value={charStates[schema.schema_key] ?? ''} onChange={(e) => {
                                        const newStates = { ...initialStates };
                                        if (!newStates[charId]) newStates[charId] = {};
                                        newStates[charId][schema.schema_key] = parseFloat(e.target.value) || 0;
                                        setInitialStates(newStates);
                                      }} />
                                    )}
                                    {schema.type === 'text' && (
                                      <Input className="h-8" value={charStates[schema.schema_key] ?? ''} onChange={(e) => {
                                        const newStates = { ...initialStates };
                                        if (!newStates[charId]) newStates[charId] = {};
                                        newStates[charId][schema.schema_key] = e.target.value;
                                        setInitialStates(newStates);
                                      }} />
                                    )}
                                    {schema.type === 'bool' && (
                                      <div className="flex items-center space-x-2 h-8">
                                        <Checkbox id={`check-${charId}-${schema.schema_id}`} checked={charStates[schema.schema_key] ?? false} onCheckedChange={(checked) => {
                                          const newStates = { ...initialStates };
                                          if (!newStates[charId]) newStates[charId] = {};
                                          newStates[charId][schema.schema_key] = checked;
                                          setInitialStates(newStates);
                                        }} />
                                        <label htmlFor={`check-${charId}-${schema.schema_id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                          {charStates[schema.schema_key] ? '是' : '否'}
                                        </label>
                                      </div>
                                    )}
                                    {schema.type === 'enum' && schema.enum_options_json && (
                                      <Select value={charStates[schema.schema_key] ?? ''} onValueChange={(val) => {
                                        const newStates = { ...initialStates };
                                        if (!newStates[charId]) newStates[charId] = {};
                                        newStates[charId][schema.schema_key] = val;
                                        setInitialStates(newStates);
                                      }}>
                                        <SelectTrigger className="h-8">
                                          <SelectValue placeholder="選擇..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {JSON.parse(schema.enum_options_json).map((opt: string) => (
                                            <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium mb-3">可選擇的角色</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {characters.filter(c => !selectedCharacterIds.includes(c.character_id)).map(char => (
                      <div key={char.character_id} className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition" onClick={() => {
                        setSelectedCharacterIds(prev => [...prev, char.character_id]);
                        // Init defaults...
                        if (creationWorldSchema.length > 0) {
                          const newStates = { ...initialStates };
                          const defaultValues: Record<string, any> = {};
                          creationWorldSchema.forEach((schema) => {
                            try {
                              defaultValues[schema.schema_key] = getSchemaDefaultValue(schema);
                            } catch {
                              defaultValues[schema.schema_key] = '';
                            }
                          });
                          newStates[char.character_id] = defaultValues;
                          setInitialStates(newStates);
                        }
                      }}>
                        <h5 className="font-medium text-sm">{char.canonical_name}</h5>
                        <p className="text-xs text-muted-foreground line-clamp-2">{char.core_profile_text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ai" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>AI 設定</CardTitle>
                <CardDescription>設定 AI 的行為準則與提示詞。</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="prompt">AI 提示詞 *</Label>
                  <Textarea
                    id="prompt"
                    value={formData.story_prompt}
                    onChange={(e) => setFormData({ ...formData, story_prompt: e.target.value })}
                    rows={10}
                    className="font-mono text-sm"
                    placeholder="給 AI 的指示，例如：\n- 故事風格和語氣\n- 角色行為準則\n- 特殊規則"
                  />
                  {errors.story_prompt && <p className="text-sm text-destructive">{errors.story_prompt}</p>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Existing Story Content (Characters List) */}
        {!isNewStory && (
          <Card>
            <CardHeader>
              <CardTitle>故事角色</CardTitle>
              <CardDescription>管理故事中的角色及其狀態。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Story Characters List */}
              {storyCharacters.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {storyCharacters.map(storyChar => {
                    const char = characters.find(c => c.character_id === storyChar.character_id);
                    if (!char) return null;
                    return (
                      <div key={storyChar.story_character_id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h4 className="font-semibold flex items-center gap-2">
                              {storyChar.display_name_override || char.canonical_name}
                              {storyChar.is_player && <Badge>玩家</Badge>}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-1">{char.core_profile_text}</p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="flex-1" onClick={() => handleEditStates(storyChar)}>編輯狀態</Button>
                          <Button size="sm" variant="outline" className="text-destructive hover:text-destructive" onClick={() => handleRemoveCharacter(storyChar.story_character_id, storyChar.display_name_override || char.canonical_name)}>移除</Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">還沒有加入任何角色</div>
              )}

              {/* Add Character Section */}
              <div className="border-t pt-6">
                <Button
                  variant="outline"
                  className="w-full justify-start text-muted-foreground"
                  onClick={() => setShowAddCharacterDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" /> 新增角色到故事
                </Button>

                <Dialog open={showAddCharacterDialog} onOpenChange={setShowAddCharacterDialog}>
                  <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>新增角色到故事</DialogTitle>
                      <DialogDescription>選擇要加入故事的角色</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="搜尋角色..."
                          className="pl-8"
                          value={characterSearch}
                          onChange={(e) => {
                            setCharacterSearch(e.target.value);
                            setCharacterPage(1);
                          }}
                        />
                      </div>
                      {/* Tag Filters */}
                      {allTags.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {allTags.map(tag => (
                            <Badge
                              key={tag}
                              variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                              className="cursor-pointer"
                              onClick={() => toggleTag(tag)}
                            >
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {/* Character List */}
                      {(() => {
                        // 先過濾可新增的角色，再分頁
                        const availableChars = filteredCharacters.filter(
                          c => !storyCharacters.some(sc => sc.character_id === c.character_id)
                        );
                        const totalPages = Math.ceil(availableChars.length / ITEMS_PER_PAGE);
                        const start = (characterPage - 1) * ITEMS_PER_PAGE;
                        const paginatedAvailableChars = availableChars.slice(start, start + ITEMS_PER_PAGE);

                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {paginatedAvailableChars.map(char => {
                                const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                                return (
                                  <div
                                    key={char.character_id}
                                    className="border rounded-lg p-3 cursor-pointer hover:bg-muted/50 transition"
                                    onClick={async () => {
                                      await handleAddCharacter(char.character_id);
                                      setShowAddCharacterDialog(false);
                                      setCharacterSearch('');
                                      setSelectedTags([]);
                                      setCharacterPage(1);
                                    }}
                                  >
                                    <h5 className="font-medium text-sm">{char.canonical_name}</h5>
                                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{char.core_profile_text}</p>
                                    {charTags.length > 0 && (
                                      <div className="flex flex-wrap gap-1 mt-2">
                                        {charTags.slice(0, 3).map((tag: string, i: number) => (
                                          <Badge key={i} variant="secondary" className="text-[10px]">{tag}</Badge>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Pagination */}
                            {totalPages > 1 && (
                              <div className="flex justify-center gap-2">
                                <Button variant="outline" size="sm" onClick={() => setCharacterPage(p => Math.max(1, p - 1))} disabled={characterPage === 1}>
                                  <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="py-1 text-sm">{characterPage} / {totalPages}</span>
                                <Button variant="outline" size="sm" onClick={() => setCharacterPage(p => Math.min(totalPages, p + 1))} disabled={characterPage === totalPages}>
                                  <ChevronRight className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                            {/* Empty State */}
                            {availableChars.length === 0 && (
                              <div className="text-center py-8 text-muted-foreground">
                                {characterSearch || selectedTags.length > 0 ? '沒有符合條件的角色' : '沒有可新增的角色'}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Play Button */}
        {!isNewStory && story?.status === 'active' && (
          <Card className="bg-gradient-to-r from-primary to-purple-600 text-primary-foreground border-none">
            <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-4">
              <h3 className="text-2xl font-bold">準備好開始冒險了嗎？</h3>
              <p className="opacity-90">當前回合數: {story.turn_count || 0}</p>
              <Button asChild size="lg" variant="secondary" className="font-bold text-lg px-8">
                <Link href={`/stories/${storyId}/play`}>
                  <Play className="mr-2 h-5 w-5" /> 進入遊戲
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {/* State Editor Dialog */}
        <Dialog open={!!editingStoryCharacter} onOpenChange={(open) => !open && handleCloseStateEditor()}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>編輯角色狀態</DialogTitle>
              <DialogDescription>
                {editingStoryCharacter?.display_name_override ||
                  characters.find(c => c.character_id === editingStoryCharacter?.character_id)?.canonical_name}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {worldSchema.length === 0 ? (
                <div className="text-center text-muted-foreground">此世界觀尚未定義狀態</div>
              ) : (
                <div className="grid gap-4">
                  {worldSchema.map(schema => (
                    <div key={schema.schema_id} className="space-y-2">
                      <Label>{schema.display_name} <span className="text-xs text-muted-foreground">({schema.type})</span></Label>
                      <p className="text-xs text-muted-foreground">{schema.ai_description}</p>

                      {schema.type === 'number' && (
                        <Input type="number" value={stateValues[schema.schema_key] ?? ''} onChange={(e) => setStateValues({ ...stateValues, [schema.schema_key]: parseFloat(e.target.value) || 0 })} />
                      )}
                      {schema.type === 'text' && (
                        <Input value={stateValues[schema.schema_key] ?? ''} onChange={(e) => setStateValues({ ...stateValues, [schema.schema_key]: e.target.value })} />
                      )}
                      {schema.type === 'bool' && (
                        <div className="flex items-center space-x-2">
                          <Checkbox id={`edit-${schema.schema_id}`} checked={stateValues[schema.schema_key] ?? false} onCheckedChange={(checked) => setStateValues({ ...stateValues, [schema.schema_key]: checked })} />
                          <label htmlFor={`edit-${schema.schema_id}`} className="text-sm font-medium leading-none cursor-pointer">{stateValues[schema.schema_key] ? '是' : '否'}</label>
                        </div>
                      )}
                      {schema.type === 'enum' && schema.enum_options_json && (
                        <Select value={stateValues[schema.schema_key] ?? ''} onValueChange={(val) => setStateValues({ ...stateValues, [schema.schema_key]: val })}>
                          <SelectTrigger>
                            <SelectValue placeholder="選擇..." />
                          </SelectTrigger>
                          <SelectContent>
                            {JSON.parse(schema.enum_options_json).map((opt: string) => (
                              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleCloseStateEditor}>取消</Button>
              <Button onClick={handleSaveStates} disabled={savingStates}>
                {savingStates && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                儲存狀態
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}

export default function StoryDetailPage() {
  return (
    <ProtectedRoute>
      <StoryDetailPageContent />
    </ProtectedRoute>
  );
}
