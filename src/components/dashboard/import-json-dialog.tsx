'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FileJson, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportJsonStepProps {
  fileName: string;
  disabled: boolean;
  onFileSelect: (file: File) => void;
}

// 只选择备份文件，读取结果交给统一创建流程，不再挂载独立弹窗或直接创建。
export function ImportJsonStep({ fileName, disabled, onFileSelect }: ImportJsonStepProps) {
  const t = useTranslations('import');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="space-y-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          if (disabled) return;
          const file = event.dataTransfer.files[0];
          if (file) onFileSelect(file);
        }}
        className={cn(
          'flex w-full cursor-pointer flex-col items-center rounded-xl border-2 border-dashed p-6 text-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none',
          isDragging ? 'border-brand bg-brand-muted' : 'border-zinc-300 hover:border-brand dark:border-zinc-600',
        )}
      >
        {fileName ? <FileJson className="mb-3 h-8 w-8 text-brand" /> : <Upload className="mb-3 h-8 w-8 text-zinc-400" />}
        <span className="max-w-full truncate text-sm font-medium">{fileName || t('selectFile')}</span>
        <span className="mt-1 text-xs text-zinc-500">{t('dragHint')}</span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".json"
        disabled={disabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.target.value = '';
        }}
      />
      <p className="text-xs text-zinc-500 dark:text-zinc-400">{t('backupHint')}</p>
    </div>
  );
}
