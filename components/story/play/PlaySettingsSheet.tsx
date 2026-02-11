'use client';

import { useStoryPlay } from '@/contexts/StoryPlayContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetDescription,
} from '@/components/ui/sheet';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Settings, AlertCircle } from 'lucide-react';
import {
  MODEL_PRESETS,
  PROVIDER_INFO,
  Provider,
  PROVIDERS,
} from '@/lib/ai-providers';

export function PlaySettingsSheet() {
  const {
    showSettingsPanel,
    setShowSettingsPanel,
    tempProvider,
    setTempProvider,
    tempUsePreset,
    setTempUsePreset,
    tempModel,
    setTempModel,
    tempCustomModel,
    setTempCustomModel,
    tempTemperature,
    setTempTemperature,
    tempContextTurns,
    setTempContextTurns,
    savingSettings,
    handleSaveSettings,
  } = useStoryPlay();

  return (
    <Sheet open={showSettingsPanel} onOpenChange={setShowSettingsPanel}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" title="設定">
          <Settings className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-[85vw] sm:w-[400px] sm:max-w-[400px] p-0 flex flex-col gap-0 h-[100dvh]"
      >
        <div className="p-6 pb-2 shrink-0">
          <SheetHeader>
            <SheetTitle>遊戲設定</SheetTitle>
            <SheetDescription>調整 AI 模型和參數</SheetDescription>
          </SheetHeader>
        </div>
        <ScrollArea className="flex-1 w-full">
          <div className="p-6 pt-0 space-y-6">
            {/* Provider */}
            <div className="space-y-2">
              <Label>API 供應商</Label>
              <Select
                value={tempProvider}
                onValueChange={(v) => {
                  setTempProvider(v as Provider);
                  setTempModel(MODEL_PRESETS[v as Provider][0] || '');
                  setTempCustomModel('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="選擇供應商" />
                </SelectTrigger>
                <SelectContent>
                  {PROVIDERS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PROVIDER_INFO[p].name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Model Selection */}
            <div className="space-y-3">
              <Label>模型名稱</Label>
              <RadioGroup
                value={tempUsePreset}
                onValueChange={(v: 'preset' | 'custom') => setTempUsePreset(v)}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="preset" id="opt-preset" />
                  <Label htmlFor="opt-preset" className="cursor-pointer font-normal">
                    選擇常用
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="opt-custom" />
                  <Label htmlFor="opt-custom" className="cursor-pointer font-normal">
                    手動輸入
                  </Label>
                </div>
              </RadioGroup>

              {tempUsePreset === 'preset' ? (
                <Select value={tempModel} onValueChange={setTempModel}>
                  <SelectTrigger>
                    <SelectValue placeholder="選擇模型" />
                  </SelectTrigger>
                  <SelectContent>
                    {MODEL_PRESETS[tempProvider].map((model) => (
                      <SelectItem key={model} value={model}>
                        {model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  value={tempCustomModel}
                  onChange={(e) => setTempCustomModel(e.target.value)}
                  placeholder="例如：anthropic/claude-3.5-sonnet"
                />
              )}
            </div>

            {/* Temperature */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label>Temperature（創意程度）</Label>
                <span className="text-sm text-muted-foreground">
                  {tempTemperature.toFixed(1)}
                </span>
              </div>
              <Slider
                value={[tempTemperature]}
                onValueChange={([v]: number[]) => setTempTemperature(v)}
                min={0}
                max={2}
                step={0.1}
              />
              <p className="text-xs text-muted-foreground">0 = 保守穩定，2 = 創意多變</p>
            </div>

            {/* Context Turns */}
            <div className="space-y-2">
              <Label>上下文回合數</Label>
              <Input
                type="number"
                value={tempContextTurns}
                onChange={(e) => setTempContextTurns(parseInt(e.target.value) || 5)}
                min={1}
                max={50}
              />
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  回合數越多，每次 AI 呼叫的 token 消耗越高，費用也會增加。
                </AlertDescription>
              </Alert>
            </div>

            <Button onClick={handleSaveSettings} disabled={savingSettings} className="w-full">
              {savingSettings && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              儲存設定
            </Button>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
