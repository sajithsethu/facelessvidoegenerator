import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { UploadCloud, Wand2, Loader, AlertCircle, Download, Undo, Redo } from 'lucide-react';
import { fileToBase64 } from '../utils/fileUtils';
import { useAuth } from './Auth';

interface ImageEditorProps {
  onImageUpload: (image: { base64: string; mimeType: string; name: string } | null) => void;
  initialImage: { base64: string; mimeType: string; name: string } | null;
}

interface Edit {
  base64: string;
  mimeType: string;
}

const downloadData = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const Placeholder: React.FC<{ onFileSelect: (file: File) => void }> = ({ onFileSelect }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) onFileSelect(e.dataTransfer.files[0]);
  };
  const handleClick = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) onFileSelect(e.target.files[0]);
  };

  return (
    <div
      onClick={handleClick} onDragOver={handleDragOver} onDrop={handleDrop}
      className="w-full h-full border-2 border-dashed border-base-300 rounded-lg flex flex-col justify-center items-center text-content-200 cursor-pointer hover:border-brand-light hover:text-brand-light transition-colors duration-300"
    >
      <UploadCloud size={64} className="mb-4" />
      <h3 className="text-xl font-semibold">Click or Drag & Drop</h3>
      <p>Upload your product photo to begin</p>
      <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" accept="image/png, image/jpeg, image/webp" />
    </div>
  );
};

export const ImageEditor: React.FC<ImageEditorProps> = ({ onImageUpload, initialImage }) => {
  const [prompt, setPrompt] = useState<string>('Remove the background, place the product on a clean, solid white background and add a soft shadow.');
  const [sourceImage, setSourceImage] = useState<{ base64: string; mimeType: string; name: string } | null>(initialImage);
  const [editHistory, setEditHistory] = useState<Edit[]>([]);
  const [currentHistoryIndex, setCurrentHistoryIndex] = useState<number>(-1);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { checkLimit, incrementUsage, showLoginModal } = useAuth();

  useEffect(() => {
    setSourceImage(initialImage);
    setEditHistory([]);
    setCurrentHistoryIndex(-1);
  }, [initialImage]);
  
  const handleFileSelect = async (file: File) => {
    try {
      const { base64, mimeType } = await fileToBase64(file);
      const newImage = { base64, mimeType, name: file.name };
      setSourceImage(newImage);
      onImageUpload(newImage);
    } catch (err) {
      setError('Failed to read the image file.');
    }
  };

  const handleGenerate = async () => {
    if (!checkLimit('image')) {
        showLoginModal();
        return;
    }
    if (!sourceImage || !prompt) {
      setError('Please upload an image and enter a prompt.');
      return;
    }
    if (!process.env.API_KEY) {
      setError('API key is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: { parts: [{ inlineData: { data: sourceImage.base64, mimeType: sourceImage.mimeType } }, { text: prompt }] },
        config: { responseModalities: [Modality.IMAGE] },
      });

      const firstPart = response.candidates?.[0]?.content?.parts?.[0];
      if (firstPart?.inlineData) {
        const newEdit = { base64: firstPart.inlineData.data, mimeType: firstPart.inlineData.mimeType };
        const newHistory = editHistory.slice(0, currentHistoryIndex + 1);
        newHistory.push(newEdit);
        setEditHistory(newHistory);
        setCurrentHistoryIndex(newHistory.length - 1);
        incrementUsage('image');
      } else {
        throw new Error('No image was generated. The model may have refused the request.');
      }
    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUndo = () => {
    if (currentHistoryIndex > 0) setCurrentHistoryIndex(prev => prev - 1);
  };
  const handleRedo = () => {
    if (currentHistoryIndex < editHistory.length - 1) setCurrentHistoryIndex(prev => prev + 1);
  };

  const handleDownload = () => {
      const currentEdit = editHistory[currentHistoryIndex];
      if (currentEdit) {
          downloadData(`data:${currentEdit.mimeType};base64,${currentEdit.base64}`, `edited-${sourceImage?.name || 'image'}.png`);
      }
  };
  
  const currentEditedImage = editHistory[currentHistoryIndex];

  return (
    <div className="flex flex-col gap-6 h-full">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow">
        <div className="bg-base-200 p-4 rounded-lg flex flex-col">
          <h2 className="text-lg font-bold mb-2 text-center text-white">Original</h2>
          <div className="flex-grow bg-base-100 rounded-md min-h-[300px] md:min-h-[400px]">
            {sourceImage ? <img src={`data:${sourceImage.mimeType};base64,${sourceImage.base64}`} alt="Original product" className="w-full h-full object-contain rounded-md" /> : <Placeholder onFileSelect={handleFileSelect} />}
          </div>
        </div>
        <div className="bg-base-200 p-4 rounded-lg flex flex-col">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-bold text-center text-white">Edited</h2>
            <div className="flex items-center gap-2">
                <button onClick={handleUndo} disabled={currentHistoryIndex <= 0} className="p-2 bg-base-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-dark"><Undo size={16}/></button>
                <button onClick={handleRedo} disabled={currentHistoryIndex >= editHistory.length - 1} className="p-2 bg-base-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-dark"><Redo size={16}/></button>
                <button onClick={handleDownload} disabled={!currentEditedImage} className="p-2 bg-base-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-dark"><Download size={16}/></button>
            </div>
          </div>
          <div className="flex-grow bg-base-100 rounded-md min-h-[300px] md:min-h-[400px] flex justify-center items-center">
            {isLoading ? <div className="flex flex-col items-center text-content-200"><Loader className="animate-spin h-12 w-12 mb-2" /><span>Enhancing photo...</span></div>
            : currentEditedImage ? <img src={`data:${currentEditedImage.mimeType};base64,${currentEditedImage.base64}`} alt="Edited product" className="w-full h-full object-contain rounded-md" />
            : <div className="text-center text-content-200"><Wand2 size={64} className="mx-auto mb-4" /><p>Your enhanced image will appear here</p></div>}
          </div>
        </div>
      </div>
       {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle size={20} /><span>{error}</span></div>}
      <div className="bg-base-200 p-4 rounded-lg flex flex-col sm:flex-row gap-4 items-center">
        <input type="text" value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., Remove background, add a soft shadow..." className="w-full flex-grow bg-base-300 border border-base-100 text-content-100 rounded-md px-4 py-2 focus:ring-2 focus:ring-brand-light focus:outline-none" disabled={isLoading || !sourceImage} />
        <button onClick={handleGenerate} disabled={isLoading || !sourceImage || !prompt} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors duration-200 disabled:bg-base-300 disabled:cursor-not-allowed disabled:text-content-200">
          {isLoading ? <Loader className="animate-spin h-5 w-5" /> : <Wand2 size={20} />}
          <span>Enhance</span>
        </button>
      </div>
    </div>
  );
};
