'use client';

import { useEffect, useState } from 'react';
import { ResumeFileUpload } from '@/components/resume/resume-file-upload';

interface ResumeDropzoneProps {
  uploading: boolean;
  onFile: (file: File) => void;
}

/**
 * 横向紧凑上传区。原来是 280px 高的空卡片，中间只放一个按钮——
 * 占了屏幕四分之一却只承载一个动作。
 */
export function ResumeDropzone({ uploading, onFile }: ResumeDropzoneProps) {
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    if (!uploading) setFile(null);
  }, [uploading]);

  return (
    <ResumeFileUpload
      file={file}
      disabled={uploading}
      onFileChange={(selectedFile) => {
        setFile(selectedFile);
        if (selectedFile) onFile(selectedFile);
      }}
    />
  );
}
