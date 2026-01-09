'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
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
  const [currentTab, setCurrentTab] = useState<'basic' | 'characters' | 'ai'>('basic');
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

  useEffect(() => {
    loadData();
  }, [user, storyId]);

  const loadData = async () => {
    if (!user) return;

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
          alert('故事不存在');
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
      alert(`載入失敗: ${err.message || '未知錯誤'}`);
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
        } catch {}
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
        const newStory = await createStory(user.user_id, {
          world_id: formData.world_id,
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_mode: formData.story_mode,
          player_character_id: formData.story_mode === 'PLAYER_CHARACTER' ? formData.player_character_id : undefined,
          story_prompt: formData.story_prompt.trim(),
        });

        // Add selected characters to the story and get story_character_ids
        const storyCharacterResults: { characterId: string; storyCharacterId: string }[] = [];

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
            storyCharacterResults.push({
              characterId: selectedCharacterIds[index],
              storyCharacterId: sc.story_character_id,
            });
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

        alert('✅ 故事創建成功！');
        router.push(`/stories/${newStory.story_id}`);
      } else {
        await updateStory(storyId, user.user_id, {
          title: formData.title.trim(),
          premise_text: formData.premise_text.trim(),
          story_prompt: formData.story_prompt.trim(),
        });

        alert('✅ 更新成功！');
        loadData();
      }
    } catch (err: any) {
      console.error('Failed to save story:', err);
      alert(`儲存失敗: ${err.message || '未知錯誤'}`);
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
        alert('此角色已在故事中');
        return;
      }

      await addStoryCharacter(user.user_id, {
        story_id: storyId,
        character_id: characterId,
        is_player: false,
      });

      alert('✅ 角色已加入故事！');
      loadData(); // Reload to get updated story characters
    } catch (err: any) {
      console.error('Failed to add character:', err);
      alert(`新增角色失敗: ${err.message || '未知錯誤'}`);
    }
  };

  const handleRemoveCharacter = async (storyCharacterId: string, characterName: string) => {
    if (!user || isNewStory) return;

    if (!confirm(`確定要從故事中移除「${characterName}」嗎？\n\n這將同時刪除該角色的所有狀態數據。`)) {
      return;
    }

    try {
      await removeStoryCharacter(storyCharacterId, user.user_id);
      alert('✅ 角色已移除！');
      loadData(); // Reload to get updated story characters
    } catch (err: any) {
      console.error('Failed to remove character:', err);
      alert(`移除角色失敗: ${err.message || '未知錯誤'}`);
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
      alert(`載入狀態失敗: ${err.message || '未知錯誤'}`);
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

      alert('✅ 狀態已儲存！');
      setEditingStoryCharacter(null);
    } catch (err: any) {
      console.error('Failed to save states:', err);
      alert(`儲存狀態失敗: ${err.message || '未知錯誤'}`);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">載入中...</p>
        </div>
      </div>
    );
  }

  const selectedWorld = worlds.find((w) => w.world_id === formData.world_id);
  const playerCharacter = characters.find((c) => c.character_id === formData.player_character_id);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {isNewStory ? '創建新故事' : story?.title}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              {isNewStory ? '設定你的互動故事' : '查看和管理故事設定'}
            </p>
          </div>
          <button
            onClick={() => router.push('/stories')}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          >
            ← 返回列表
          </button>
        </div>

        {/* Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          {/* Tabs (only for new story) */}
          {isNewStory && (
            <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
              <div className="flex gap-4">
                <button
                  onClick={() => setCurrentTab('basic')}
                  className={`pb-3 px-2 font-medium text-sm transition border-b-2 ${
                    currentTab === 'basic'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  基本設定
                </button>
                <button
                  onClick={() => setCurrentTab('characters')}
                  className={`pb-3 px-2 font-medium text-sm transition border-b-2 ${
                    currentTab === 'characters'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  故事角色 {selectedCharacterIds.length > 0 && `(${selectedCharacterIds.length})`}
                </button>
                <button
                  onClick={() => setCurrentTab('ai')}
                  className={`pb-3 px-2 font-medium text-sm transition border-b-2 ${
                    currentTab === 'ai'
                      ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  AI 設定
                </button>
              </div>
            </div>
          )}

          {/* Tab: Basic Settings */}
          {(isNewStory && currentTab === 'basic') || !isNewStory ? (
            <>
              {/* World Selection */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              世界觀 *
            </label>
            {isNewStory ? (
              <>
                {selectedWorld ? (
                  <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-2">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {selectedWorld.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                          {selectedWorld.description}
                        </p>
                      </div>
                      <button
                        onClick={() => {
                          setFormData({ ...formData, world_id: '' });
                          setWorldSearch('');
                          setWorldPage(1);
                        }}
                        className="ml-4 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                      >
                        清除
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowWorldSelector(!showWorldSelector)}
                    className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 transition"
                  >
                    {showWorldSelector ? '收起選擇器' : '+ 選擇世界觀'}
                  </button>
                )}

                {showWorldSelector && !selectedWorld && (
                  <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                    {/* Search */}
                    <input
                      type="text"
                      value={worldSearch}
                      onChange={(e) => {
                        setWorldSearch(e.target.value);
                        setWorldPage(1);
                      }}
                      placeholder="搜尋世界觀..."
                      className="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    />

                    {/* World Cards */}
                    {paginatedWorlds.length === 0 ? (
                      <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                        {worlds.length === 0 ? '還沒有世界觀，請先創建一個' : '找不到符合條件的世界觀'}
                      </p>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {paginatedWorlds.map((world) => (
                            <button
                              key={world.world_id}
                              onClick={() => handleWorldSelect(world.world_id)}
                              className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
                            >
                              <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                {world.name}
                              </h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                                {world.description}
                              </p>
                            </button>
                          ))}
                        </div>

                        {/* Pagination */}
                        {worldTotalPages > 1 && (
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => setWorldPage((p) => Math.max(1, p - 1))}
                              disabled={worldPage === 1}
                              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              上一頁
                            </button>
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                              {worldPage} / {worldTotalPages}
                            </span>
                            <button
                              onClick={() => setWorldPage((p) => Math.min(worldTotalPages, p + 1))}
                              disabled={worldPage === worldTotalPages}
                              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              下一頁
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {errors.world_id && (
                  <p className="mt-1 text-sm text-red-600">{errors.world_id}</p>
                )}
              </>
            ) : (
              <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <p className="text-gray-900 dark:text-white font-medium">
                  {selectedWorld?.name || '未知世界觀'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {selectedWorld?.description}
                </p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              故事標題 *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="給你的故事起個名字"
            />
            {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title}</p>}
          </div>

          {/* Premise */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              故事前提 *
            </label>
            <textarea
              value={formData.premise_text}
              onChange={(e) => setFormData({ ...formData, premise_text: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
              placeholder="描述故事的背景和起始狀況"
            />
            {errors.premise_text && <p className="mt-1 text-sm text-red-600">{errors.premise_text}</p>}
          </div>

          {/* Story Mode */}
          {isNewStory && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                遊戲模式 *
              </label>
              <div className="space-y-3">
                <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <input
                    type="radio"
                    name="story_mode"
                    value="PLAYER_CHARACTER"
                    checked={formData.story_mode === 'PLAYER_CHARACTER'}
                    onChange={(e) =>
                      setFormData({ ...formData, story_mode: e.target.value as StoryMode })
                    }
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">
                      玩家角色模式
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      你將扮演一個特定角色，從第一人稱視角體驗故事
                    </p>
                  </div>
                </label>

                <label className="flex items-start p-4 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition">
                  <input
                    type="radio"
                    name="story_mode"
                    value="DIRECTOR"
                    checked={formData.story_mode === 'DIRECTOR'}
                    onChange={(e) =>
                      setFormData({ ...formData, story_mode: e.target.value as StoryMode })
                    }
                    className="mt-1 mr-3"
                  />
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">導演模式</div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      你將作為導演，從上帝視角控制整個故事的發展
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Player Character (only in PLAYER_CHARACTER mode) */}
          {formData.story_mode === 'PLAYER_CHARACTER' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                玩家角色 *
              </label>
              {isNewStory ? (
                <>
                  {playerCharacter ? (
                    <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 mb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {playerCharacter.canonical_name}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {playerCharacter.core_profile_text}
                          </p>
                          {playerCharacter.tags_json && JSON.parse(playerCharacter.tags_json).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {JSON.parse(playerCharacter.tags_json).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            setFormData({ ...formData, player_character_id: '' });
                            setCharacterSearch('');
                            setSelectedTags([]);
                            setCharacterPage(1);
                          }}
                          className="ml-4 px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowCharacterSelector(!showCharacterSelector)}
                      className="w-full px-4 py-3 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-600 transition"
                    >
                      {showCharacterSelector ? '收起選擇器' : '+ 選擇玩家角色'}
                    </button>
                  )}

                  {showCharacterSelector && !playerCharacter && (
                    <div className="mt-4 border border-gray-300 dark:border-gray-600 rounded-lg p-4">
                      {/* Search */}
                      <input
                        type="text"
                        value={characterSearch}
                        onChange={(e) => {
                          setCharacterSearch(e.target.value);
                          setCharacterPage(1);
                        }}
                        placeholder="搜尋角色名稱或描述..."
                        className="w-full px-4 py-2 mb-4 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                      />

                      {/* Tag Filter */}
                      {allTags.length > 0 && (
                        <div className="mb-4">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            篩選標籤:
                          </p>
                          <div className="flex flex-wrap gap-2">
                            {allTags.map((tag) => (
                              <button
                                key={tag}
                                onClick={() => toggleTag(tag)}
                                className={`px-3 py-1 text-sm rounded transition ${
                                  selectedTags.includes(tag)
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                                }`}
                              >
                                {tag}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Character Cards */}
                      {paginatedCharacters.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                          {characters.length === 0 ? '還沒有角色，請先創建一個' : '找不到符合條件的角色'}
                        </p>
                      ) : (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            {paginatedCharacters.map((char) => {
                              const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                              return (
                                <button
                                  key={char.character_id}
                                  onClick={() => {
                                    setFormData({ ...formData, player_character_id: char.character_id });
                                    setShowCharacterSelector(false);
                                  }}
                                  className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
                                >
                                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                                    {char.canonical_name}
                                  </h4>
                                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                    {char.core_profile_text}
                                  </p>
                                  {charTags.length > 0 && (
                                    <div className="flex flex-wrap gap-1">
                                      {charTags.map((tag: string) => (
                                        <span
                                          key={tag}
                                          className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded"
                                        >
                                          {tag}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>

                          {/* Pagination */}
                          {characterTotalPages > 1 && (
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => setCharacterPage((p) => Math.max(1, p - 1))}
                                disabled={characterPage === 1}
                                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                上一頁
                              </button>
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {characterPage} / {characterTotalPages}
                              </span>
                              <button
                                onClick={() => setCharacterPage((p) => Math.min(characterTotalPages, p + 1))}
                                disabled={characterPage === characterTotalPages}
                                className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                下一頁
                              </button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {errors.player_character_id && (
                    <p className="mt-1 text-sm text-red-600">{errors.player_character_id}</p>
                  )}
                </>
              ) : (
                <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <p className="text-gray-900 dark:text-white font-medium">
                    {playerCharacter?.canonical_name || '未知角色'}
                  </p>
                </div>
              )}
            </div>
          )}

            </>
          ) : null}

          {/* Tab: Characters */}
          {isNewStory && currentTab === 'characters' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  選擇故事角色
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  選擇要加入故事的角色（可以在創建後繼續新增或移除）
                </p>
              </div>

              {selectedCharacterIds.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    已選擇 ({selectedCharacterIds.length} 個角色)
                  </h4>
                  <div className="space-y-3">
                    {selectedCharacterIds.map((charId) => {
                      const char = characters.find((c) => c.character_id === charId);
                      if (!char) return null;
                      const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                      const isEditing = editingCharacterId === charId;
                      const charStates = initialStates[charId] || {};

                      return (
                        <div
                          key={charId}
                          className="border border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <div className="flex items-start justify-between p-3">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 dark:text-white text-sm">
                                {char.canonical_name}
                              </h5>
                              <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                                {char.core_profile_text}
                              </p>
                              {charTags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {charTags.slice(0, 2).map((tag: string) => (
                                    <span
                                      key={tag}
                                      className="px-1.5 py-0.5 text-xs bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200 rounded"
                                    >
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="flex gap-2 ml-3">
                              {formData.world_id && creationWorldSchema.length > 0 && (
                                <button
                                  onClick={() =>
                                    setEditingCharacterId(isEditing ? null : charId)
                                  }
                                  className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                                >
                                  {isEditing ? '收起' : '設定狀態'}
                                </button>
                              )}
                              <button
                                onClick={() =>
                                  setSelectedCharacterIds((prev) =>
                                    prev.filter((id) => id !== charId)
                                  )
                                }
                                className="px-2 py-1 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition border border-red-300 dark:border-red-600"
                              >
                                移除
                              </button>
                            </div>
                          </div>

                          {/* Initial State Editor */}
                          {isEditing && formData.world_id && (
                            <div className="border-t border-blue-300 dark:border-blue-600 p-3 bg-white dark:bg-gray-800">
                              <h6 className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                                初始狀態設定
                              </h6>
                              <div className="space-y-3">
                                {creationWorldSchema.map((schema) => (
                                  <div key={schema.schema_id} className="space-y-1">
                                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                      {schema.display_name}
                                      <span className="ml-1 text-xs text-gray-500 dark:text-gray-400">
                                        ({schema.type})
                                      </span>
                                    </label>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                                      {schema.ai_description}
                                    </p>

                                    {/* Number input */}
                                    {schema.type === 'number' && (
                                      <input
                                        type="number"
                                        value={charStates[schema.schema_key] ?? ''}
                                        onChange={(e) => {
                                          const newStates = { ...initialStates };
                                          if (!newStates[charId]) newStates[charId] = {};
                                          newStates[charId][schema.schema_key] =
                                            parseFloat(e.target.value) || 0;
                                          setInitialStates(newStates);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      />
                                    )}

                                    {/* Text input */}
                                    {schema.type === 'text' && (
                                      <input
                                        type="text"
                                        value={charStates[schema.schema_key] ?? ''}
                                        onChange={(e) => {
                                          const newStates = { ...initialStates };
                                          if (!newStates[charId]) newStates[charId] = {};
                                          newStates[charId][schema.schema_key] = e.target.value;
                                          setInitialStates(newStates);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      />
                                    )}

                                    {/* Boolean input */}
                                    {schema.type === 'bool' && (
                                      <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={charStates[schema.schema_key] ?? false}
                                          onChange={(e) => {
                                            const newStates = { ...initialStates };
                                            if (!newStates[charId]) newStates[charId] = {};
                                            newStates[charId][schema.schema_key] =
                                              e.target.checked;
                                            setInitialStates(newStates);
                                          }}
                                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-xs text-gray-700 dark:text-gray-300">
                                          {charStates[schema.schema_key] ? '是' : '否'}
                                        </span>
                                      </label>
                                    )}

                                    {/* Enum select */}
                                    {schema.type === 'enum' && schema.enum_options_json && (
                                      <select
                                        value={charStates[schema.schema_key] ?? ''}
                                        onChange={(e) => {
                                          const newStates = { ...initialStates };
                                          if (!newStates[charId]) newStates[charId] = {};
                                          newStates[charId][schema.schema_key] = e.target.value;
                                          setInitialStates(newStates);
                                        }}
                                        className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      >
                                        <option value="">選擇...</option>
                                        {JSON.parse(schema.enum_options_json).map(
                                          (option: string) => (
                                            <option key={option} value={option}>
                                              {option}
                                            </option>
                                          )
                                        )}
                                      </select>
                                    )}

                                    {/* List of text */}
                                    {schema.type === 'list_text' && (
                                      <textarea
                                        value={
                                          Array.isArray(charStates[schema.schema_key])
                                            ? charStates[schema.schema_key].join('\n')
                                            : ''
                                        }
                                        onChange={(e) => {
                                          const newStates = { ...initialStates };
                                          if (!newStates[charId]) newStates[charId] = {};
                                          newStates[charId][schema.schema_key] = e.target.value
                                            .split('\n')
                                            .filter((line) => line.trim());
                                          setInitialStates(newStates);
                                        }}
                                        rows={3}
                                        placeholder="每行一個項目"
                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                                      />
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {formData.world_id && creationWorldSchema.length === 0 && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      此世界觀尚未定義狀態 Schema，創建後角色將使用預設狀態
                    </p>
                  )}
                  {!formData.world_id && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      請先在「基本設定」中選擇世界觀，才能設定角色初始狀態
                    </p>
                  )}
                </div>
              )}

              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  可選擇的角色
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {characters
                    .filter((char) => !selectedCharacterIds.includes(char.character_id))
                    .map((char) => {
                      const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                      return (
                        <button
                          key={char.character_id}
                          onClick={() => {
                            setSelectedCharacterIds((prev) => [...prev, char.character_id]);
                            // Initialize default states for this character
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
                          }}
                          className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
                        >
                          <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                            {char.canonical_name}
                          </h5>
                          <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                            {char.core_profile_text}
                          </p>
                          {charTags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {charTags.slice(0, 3).map((tag: string) => (
                                <span
                                  key={tag}
                                  className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </button>
                      );
                    })}
                </div>
                {characters.filter((char) => !selectedCharacterIds.includes(char.character_id))
                  .length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-8">
                    所有角色都已選擇
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Tab: AI Settings */}
          {(isNewStory && currentTab === 'ai') || !isNewStory ? (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                AI 提示詞 *
              </label>
              <textarea
                value={formData.story_prompt}
                onChange={(e) => setFormData({ ...formData, story_prompt: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm font-mono"
                placeholder="給 AI 的指示，例如：\n- 故事風格和語氣\n- 角色行為準則\n- 特殊規則"
              />
              {errors.story_prompt && <p className="mt-1 text-sm text-red-600">{errors.story_prompt}</p>}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                這個提示詞會在每次 AI 生成回應時使用，用來指導 AI 的行為
              </p>
            </div>
          ) : null}

          {/* Actions */}
          <div className="flex gap-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
            >
              {saving ? '儲存中...' : isNewStory ? '✨ 創建故事' : '💾 儲存更改'}
            </button>
            <button
              onClick={() => router.push('/stories')}
              className="px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition"
            >
              取消
            </button>
          </div>
        </div>

        {/* Story Characters Management (only for existing stories) */}
        {!isNewStory && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                故事角色
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {storyCharacters.length} 個角色
              </p>
            </div>

            {/* Story characters list */}
            {storyCharacters.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  還沒有加入任何角色到故事中
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  從下方選擇角色加入故事
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {storyCharacters.map((storyChar) => {
                  const char = characters.find((c) => c.character_id === storyChar.character_id);
                  if (!char) return null;

                  return (
                    <div
                      key={storyChar.story_character_id}
                      className="border border-gray-300 dark:border-gray-600 rounded-lg p-4"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {storyChar.display_name_override || char.canonical_name}
                            {storyChar.is_player && (
                              <span className="ml-2 px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                                玩家角色
                              </span>
                            )}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {char.core_profile_text}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleEditStates(storyChar)}
                          className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
                        >
                          編輯狀態
                        </button>
                        <button
                          onClick={() =>
                            handleRemoveCharacter(
                              storyChar.story_character_id,
                              storyChar.display_name_override || char.canonical_name
                            )
                          }
                          className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition border border-red-300 dark:border-red-600"
                          title="移除角色"
                        >
                          移除
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add character section */}
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                新增角色到故事
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {characters
                  .filter(
                    (char) =>
                      !storyCharacters.some((sc) => sc.character_id === char.character_id)
                  )
                  .map((char) => {
                    const charTags = char.tags_json ? JSON.parse(char.tags_json) : [];
                    return (
                      <button
                        key={char.character_id}
                        onClick={() => handleAddCharacter(char.character_id)}
                        className="p-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition text-left"
                      >
                        <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                          {char.canonical_name}
                        </h4>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2 mb-1">
                          {char.core_profile_text}
                        </p>
                        {charTags.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {charTags.slice(0, 3).map((tag: string) => (
                              <span
                                key={tag}
                                className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
              </div>
              {characters.filter(
                (char) => !storyCharacters.some((sc) => sc.character_id === char.character_id)
              ).length === 0 && (
                <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                  所有角色都已加入故事中
                </p>
              )}
            </div>
          </div>
        )}

        {/* Play Button (only for existing stories) */}
        {!isNewStory && story?.status === 'active' && (
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg shadow-md p-6 text-white text-center">
            <h3 className="text-xl font-semibold mb-2">準備好開始冒險了嗎？</h3>
            <p className="mb-4 opacity-90">
              當前回合數: {story.turn_count || 0}
            </p>
            <button
              onClick={() => router.push(`/stories/${storyId}/play`)}
              className="px-8 py-3 bg-white text-blue-600 rounded-lg hover:bg-gray-100 transition font-semibold"
            >
              🎮 進入遊戲
            </button>
          </div>
        )}

        {/* State Editor Modal */}
        {editingStoryCharacter && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  編輯角色狀態
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {editingStoryCharacter.display_name_override ||
                    characters.find((c) => c.character_id === editingStoryCharacter.character_id)?.canonical_name}
                </p>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {worldSchema.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      此世界觀尚未定義任何狀態欄位
                    </p>
                    <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">
                      請先在世界觀設定中新增狀態 Schema
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {worldSchema.map((schema) => (
                      <div key={schema.schema_id} className="space-y-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          {schema.display_name}
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            ({schema.type})
                          </span>
                        </label>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                          {schema.ai_description}
                        </p>

                        {/* Number input */}
                        {schema.type === 'number' && (
                          <input
                            type="number"
                            value={stateValues[schema.schema_key] ?? ''}
                            onChange={(e) =>
                              setStateValues({
                                ...stateValues,
                                [schema.schema_key]: parseFloat(e.target.value) || 0,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        )}

                        {/* Text input */}
                        {schema.type === 'text' && (
                          <input
                            type="text"
                            value={stateValues[schema.schema_key] ?? ''}
                            onChange={(e) =>
                              setStateValues({
                                ...stateValues,
                                [schema.schema_key]: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          />
                        )}

                        {/* Boolean input */}
                        {schema.type === 'bool' && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={stateValues[schema.schema_key] ?? false}
                              onChange={(e) =>
                                setStateValues({
                                  ...stateValues,
                                  [schema.schema_key]: e.target.checked,
                                })
                              }
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              {stateValues[schema.schema_key] ? '是' : '否'}
                            </span>
                          </label>
                        )}

                        {/* Enum select */}
                        {schema.type === 'enum' && schema.enum_options_json && (
                          <select
                            value={stateValues[schema.schema_key] ?? ''}
                            onChange={(e) =>
                              setStateValues({
                                ...stateValues,
                                [schema.schema_key]: e.target.value,
                              })
                            }
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                          >
                            <option value="">選擇...</option>
                            {JSON.parse(schema.enum_options_json).map((option: string) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        )}

                        {/* List of text */}
                        {schema.type === 'list_text' && (
                          <textarea
                            value={
                              Array.isArray(stateValues[schema.schema_key])
                                ? stateValues[schema.schema_key].join('\n')
                                : ''
                            }
                            onChange={(e) =>
                              setStateValues({
                                ...stateValues,
                                [schema.schema_key]: e.target.value
                                  .split('\n')
                                  .filter((line) => line.trim()),
                              })
                            }
                            rows={4}
                            placeholder="每行一個項目"
                            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white text-sm"
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
                <button
                  onClick={handleSaveStates}
                  disabled={savingStates || worldSchema.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
                >
                  {savingStates ? '儲存中...' : '💾 儲存狀態'}
                </button>
                <button
                  onClick={handleCloseStateEditor}
                  disabled={savingStates}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

export default function StoryDetailPage() {
  return (
    <ProtectedRoute>
      <StoryDetailPageContent />
    </ProtectedRoute>
  );
}
