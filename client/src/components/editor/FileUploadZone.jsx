import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { ALL_SUPPORTED_EXTENSIONS } from '../../utils/languageMap';

export const FileUploadZone = forwardRef(function FileUploadZone(
  { onFileSelected, children, className = '' },
  ref
) {
  const fileInputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    openFileDialog: () => {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
        fileInputRef.current.click();
      }
    }
  }));

  const handleInputChange = (event) => {
    const file = event.target.files?.[0];
    if (file && onFileSelected) {
      onFileSelected(file);
    }
    // Reset input value so re-selecting the same file triggers change
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const file = event.dataTransfer.files?.[0];
    if (file && onFileSelected) {
      onFileSelected(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative ${className}`}
    >
      <input
        ref={fileInputRef}
        type="file"
        data-testid="code-file-input"
        accept={ALL_SUPPORTED_EXTENSIONS.join(',')}
        onChange={handleInputChange}
        className="hidden"
        aria-label="Upload source code file"
      />
      {children}
    </div>
  );
});

export default FileUploadZone;
