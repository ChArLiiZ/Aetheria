# 資料庫重試機制遷移指南

## 概述

新的重試機制提供：
- **自動重試**：失敗時自動重試最多 3 次
- **智能逾時**：首次 5 秒，之後遞增 (5s → 7.5s → 11.25s)
- **詳細錯誤**：清楚顯示重試次數和失敗原因

## 轉換模式

### 舊模式 (Promise.race)

```typescript
export async function getStories(userId: string): Promise<Story[]> {
  // Use Promise.race to prevent hanging issues
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Database operation timed out after 10 seconds')), 10000);
  });

  const fetchPromise = supabase
    .from('stories')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error('Failed to fetch stories: ' + error.message);
  }

  return (data || []) as Story[];
}
```

### 新模式 (withRetry)

```typescript
import { withRetry } from '@/lib/supabase/retry';

export async function getStories(userId: string): Promise<Story[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('stories')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) {
      throw new Error('Failed to fetch stories: ' + error.message);
    }

    return (data || []) as Story[];
  });
}
```

## 轉換步驟

### 1. 添加 Import

```typescript
import { withRetry } from '@/lib/supabase/retry';
```

### 2. 移除舊的逾時程式碼

刪除：
```typescript
const timeoutPromise = new Promise<never>(...);
const fetchPromise = supabase...;
const result = await Promise.race([fetchPromise, timeoutPromise]);
const { data, error } = result as any;
```

### 3. 包裝成 withRetry

替換為：
```typescript
return withRetry(async () => {
  const { data, error } = await supabase...;
  // 錯誤處理和返回邏輯
});
```

## 特殊情況處理

### 情況 1：返回 null 而非拋出錯誤

```typescript
// 舊
if (error) {
  if (error.code === 'PGRST116') {
    return null;
  }
  throw new Error(...);
}

// 新 - 保持相同邏輯
return withRetry(async () => {
  const { data, error } = await supabase...;

  if (error) {
    if (error.code === 'PGRST116') {
      return null;  // 不拋出錯誤，直接返回 null
    }
    throw new Error(...);
  }

  return data;
});
```

### 情況 2：檢查名稱是否存在

```typescript
// 舊
export async function worldNameExists(userId: string, name: string): Promise<boolean> {
  const timeoutPromise = ...;
  const fetchPromise = supabase...;
  const result = await Promise.race([fetchPromise, timeoutPromise]);
  const { data, error } = result as any;

  if (error) {
    throw new Error(...);
  }

  return (data || []).length > 0;
}

// 新
export async function worldNameExists(userId: string, name: string): Promise<boolean> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('worlds')
      .select('world_id')
      .eq('user_id', userId)
      .eq('name', name)
      .limit(1);

    if (error) {
      throw new Error('Failed to check world name: ' + error.message);
    }

    return (data || []).length > 0;
  });
}
```

### 情況 3：不需要重試的操作（Create/Update/Delete）

對於寫入操作，通常不需要重試邏輯（可能導致重複寫入）。這些可以保持原樣：

```typescript
// Create/Update/Delete 可以不使用 withRetry
export async function createWorld(userId: string, data: {...}): Promise<World> {
  const { data: newWorld, error } = await supabase
    .from('worlds')
    .insert({...})
    .select()
    .single();

  if (error || !newWorld) {
    throw new Error('Failed to create world: ' + error?.message);
  }

  return newWorld as World;
}
```

**注意**：如果寫入操作是冪等的（idempotent），可以使用 withRetry。

## 已完成轉換的檔案

- ✅ `services/supabase/stories.ts` - 部分完成 (2/4 函數)
- ⏳ `services/supabase/worlds.ts` - 待完成 (0/4 函數)
- ⏳ `services/supabase/story-turns.ts` - 待完成 (0/10 函數)
- ⏳ `services/supabase/story-characters.ts` - 待完成 (0/10 函數)
- ⏳ `services/supabase/story-state-values.ts` - 待完成 (0/14 函數)
- ⏳ `services/supabase/story-relationships.ts` - 待完成 (0/12 函數)

## 測試檢查清單

轉換後請測試：
1. ✅ 正常操作能否成功
2. ✅ 網路延遲時是否自動重試
3. ✅ 錯誤訊息是否清楚
4. ✅ 重試次數是否正確

## 自定義重試選項

可以針對特定操作自定義重試參數：

```typescript
return withRetry(
  async () => {
    // 操作
  },
  {
    maxRetries: 5,        // 重試 5 次
    initialTimeout: 3000, // 首次逾時 3 秒
    timeoutMultiplier: 2, // 每次翻倍 (3s, 6s, 12s, 24s, 48s)
    onRetry: (attempt, error) => {
      console.log(`重試第 ${attempt} 次`, error);
    }
  }
);
```

## 常見問題

### Q: 為什麼首次逾時從 10 秒改成 5 秒？
A: 5 秒可以更快發現問題並重試。總等待時間仍可達 23.75 秒 (5 + 7.5 + 11.25)。

### Q: 寫入操作應該使用重試嗎？
A: 謹慎使用。只在操作是冪等的情況下使用（例如 upsert）。

### Q: 如何暫時停用重試？
A: 設定 `maxRetries: 1`：
```typescript
withRetry(async () => {...}, { maxRetries: 1 })
```

### Q: 如何查看重試日誌？
A: 重試時會自動在 console 輸出，也可以使用 `onRetry` 回調。
