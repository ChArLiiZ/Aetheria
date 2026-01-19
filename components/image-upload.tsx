'use client';

import { useState, useRef, useCallback } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Loader2, Upload, X, Image as ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
import imageCompression from 'browser-image-compression';
import { cn } from '@/lib/utils';

interface ImageUploadProps {
    /** 當前圖片 URL（用於預覽） */
    imageUrl?: string | null;
    /** 圖片上傳/刪除後的回調 */
    onImageChange: (file: File | null) => void;
    /** 是否正在載入 */
    isLoading?: boolean;
    /** 自訂 className */
    className?: string;
    /** 是否禁用 */
    disabled?: boolean;
    /** 裁切比例 (預設 1:1) */
    aspectRatio?: number;
    /** 裁切形狀 (預設 rect) */
    cropShape?: 'rect' | 'round';
}

// 壓縮選項
const COMPRESSION_OPTIONS = {
    maxSizeMB: 0.5,           // 最大 500KB
    maxWidthOrHeight: 1024,   // 最大尺寸 1024px
    useWebWorker: true,
    fileType: 'image/webp' as const,
};

// 將裁切區域轉換為 canvas 並輸出 Blob
async function getCroppedImage(
    imageSrc: string,
    pixelCrop: Area
): Promise<Blob> {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
        throw new Error('No 2d context');
    }

    // 設定 canvas 尺寸為裁切區域大小
    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    // 繪製裁切區域
    ctx.drawImage(
        image,
        pixelCrop.x,
        pixelCrop.y,
        pixelCrop.width,
        pixelCrop.height,
        0,
        0,
        pixelCrop.width,
        pixelCrop.height
    );

    // 轉換為 Blob
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas is empty'));
                }
            },
            'image/webp',
            0.9
        );
    });
}

function createImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.addEventListener('load', () => resolve(image));
        image.addEventListener('error', (error) => reject(error));
        image.setAttribute('crossOrigin', 'anonymous');
        image.src = url;
    });
}

export function ImageUpload({
    imageUrl,
    onImageChange,
    isLoading = false,
    className,
    disabled = false,
    aspectRatio = 1,
    cropShape = 'rect',
}: ImageUploadProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isCompressing, setIsCompressing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 裁切對話框狀態
    const [showCropDialog, setShowCropDialog] = useState(false);
    const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
    const [crop, setCrop] = useState({ x: 0, y: 0 });
    const [zoom, setZoom] = useState(1);
    const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);

    // 顯示的圖片（預覽優先）
    const displayUrl = previewUrl || imageUrl;

    // 處理圖片壓縮
    const compressImage = async (blob: Blob): Promise<File> => {
        try {
            setIsCompressing(true);
            setError(null);

            // 將 Blob 轉換為 File
            const file = new File([blob], 'image.webp', { type: 'image/webp' });
            const compressedFile = await imageCompression(file, COMPRESSION_OPTIONS);

            // 產生預覽 URL
            const url = URL.createObjectURL(compressedFile);
            setPreviewUrl(url);

            return compressedFile;
        } catch (err) {
            console.error('圖片壓縮失敗:', err);
            setError('圖片處理失敗，請嘗試其他圖片');
            throw err;
        } finally {
            setIsCompressing(false);
        }
    };

    // 處理檔案選擇，開啟裁切對話框
    const handleFileSelect = useCallback(async (file: File) => {
        // 驗證檔案類型
        if (!file.type.startsWith('image/')) {
            setError('請選擇圖片檔案');
            return;
        }

        // 驗證檔案大小（原始檔案最大 10MB）
        if (file.size > 10 * 1024 * 1024) {
            setError('圖片大小不能超過 10MB');
            return;
        }

        setError(null);

        // 讀取圖片並開啟裁切對話框
        const reader = new FileReader();
        reader.onload = () => {
            setCropImageSrc(reader.result as string);
            setCrop({ x: 0, y: 0 });
            setZoom(1);
            setShowCropDialog(true);
        };
        reader.readAsDataURL(file);
    }, []);

    // 裁切完成回調
    const onCropComplete = useCallback((_: Area, croppedAreaPixels: Area) => {
        setCroppedAreaPixels(croppedAreaPixels);
    }, []);

    // 確認裁切
    const handleCropConfirm = async () => {
        if (!cropImageSrc || !croppedAreaPixels) return;

        try {
            const croppedBlob = await getCroppedImage(cropImageSrc, croppedAreaPixels);
            const compressedFile = await compressImage(croppedBlob);
            onImageChange(compressedFile);
            setShowCropDialog(false);
            setCropImageSrc(null);
        } catch (err) {
            console.error('裁切失敗:', err);
            setError('圖片裁切失敗，請重試');
        }
    };

    // 取消裁切
    const handleCropCancel = () => {
        setShowCropDialog(false);
        setCropImageSrc(null);
    };

    // 處理 input change
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
        // 清空 input value 以允許重複選擇相同檔案
        e.target.value = '';
    };

    // 處理拖放
    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!disabled) {
            setIsDragging(true);
        }
    }, [disabled]);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (disabled) return;

        const file = e.dataTransfer.files?.[0];
        if (file) {
            handleFileSelect(file);
        }
    }, [disabled, handleFileSelect]);

    // 刪除圖片
    const handleRemove = () => {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
        }
        setPreviewUrl(null);
        setError(null);
        onImageChange(null);
    };

    // 點擊上傳區域
    const handleClick = () => {
        if (!disabled && fileInputRef.current) {
            fileInputRef.current.click();
        }
    };

    const isProcessing = isLoading || isCompressing;

    return (
        <>
            <div className={cn('space-y-2', className)}>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleInputChange}
                    className="hidden"
                    disabled={disabled || isProcessing}
                />

                {displayUrl ? (
                    // 有圖片時顯示預覽
                    <div className="relative group">
                        <div className={cn(
                            "relative w-full max-w-[200px] aspect-square overflow-hidden border bg-muted",
                            cropShape === 'round' ? 'rounded-full' : 'rounded-lg'
                        )}>
                            <img
                                src={displayUrl}
                                alt="預覽圖片"
                                className="w-full h-full object-cover"
                            />
                            {isProcessing && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                </div>
                            )}
                        </div>
                        {!disabled && !isProcessing && (
                            <div className="absolute -top-2 -right-2 flex gap-1">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="icon"
                                    className="h-7 w-7 rounded-full shadow-md"
                                    onClick={handleClick}
                                >
                                    <Upload className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="h-7 w-7 rounded-full shadow-md"
                                    onClick={handleRemove}
                                >
                                    <X className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        )}
                    </div>
                ) : (
                    // 無圖片時顯示上傳區域
                    <div
                        onClick={handleClick}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        className={cn(
                            'flex flex-col items-center justify-center',
                            'w-full max-w-[200px] aspect-square',
                            'rounded-lg border-2 border-dashed',
                            'cursor-pointer transition-colors',
                            isDragging && 'border-primary bg-primary/5',
                            !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50',
                            disabled && 'opacity-50 cursor-not-allowed',
                            isProcessing && 'pointer-events-none'
                        )}
                    >
                        {isProcessing ? (
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        ) : (
                            <>
                                <ImageIcon className="h-8 w-8 text-muted-foreground mb-2" />
                                <p className="text-sm text-muted-foreground text-center px-2">
                                    點擊或拖放圖片
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">
                                    JPG, PNG, WebP
                                </p>
                            </>
                        )}
                    </div>
                )}

                {error && (
                    <p className="text-sm text-destructive">{error}</p>
                )}
            </div>

            {/* 裁切對話框 */}
            <Dialog open={showCropDialog} onOpenChange={setShowCropDialog}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>調整圖片</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4">
                        {/* 裁切區域 */}
                        <div className="relative h-[300px] bg-muted rounded-lg overflow-hidden">
                            {cropImageSrc && (
                                <Cropper
                                    image={cropImageSrc}
                                    crop={crop}
                                    zoom={zoom}
                                    aspect={aspectRatio}
                                    cropShape={cropShape}
                                    showGrid={cropShape === 'rect'}
                                    onCropChange={setCrop}
                                    onCropComplete={onCropComplete}
                                    onZoomChange={setZoom}
                                />
                            )}
                        </div>

                        {/* 縮放控制 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>縮放</Label>
                                <span className="text-sm text-muted-foreground">{zoom.toFixed(1)}x</span>
                            </div>
                            <div className="flex items-center gap-3">
                                <ZoomOut className="h-4 w-4 text-muted-foreground" />
                                <Slider
                                    value={[zoom]}
                                    onValueChange={(values) => setZoom(values[0])}
                                    min={1}
                                    max={3}
                                    step={0.1}
                                    className="flex-1"
                                />
                                <ZoomIn className="h-4 w-4 text-muted-foreground" />
                            </div>
                        </div>

                        <p className="text-xs text-muted-foreground text-center">
                            拖曳圖片調整位置，使用滑桿調整縮放
                        </p>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={handleCropCancel}>
                            取消
                        </Button>
                        <Button onClick={handleCropConfirm} disabled={isCompressing}>
                            {isCompressing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            確認
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
