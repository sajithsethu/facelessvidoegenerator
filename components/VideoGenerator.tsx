import React, { useState, useEffect, useCallback } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Video, Film, Loader, AlertCircle, KeyRound, Download } from 'lucide-react';
import { useAuth } from './Auth';

interface VideoGeneratorProps {
  sourceImage: { base64: string; mimeType: string; name: string } | null;
}

const LOADING_MESSAGES = [
  "Warming up the video engine...", "Sending your vision to the AI...", "Generating initial frames...",
  "Rendering high-resolution scenes...", "Adding cinematic touches...", "Finalizing your video... This can take a few minutes.",
];

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ sourceImage }) => {
  const [prompt, setPrompt] = useState<string>('Create a slow 360-degree rotating view of this product on a clean, professional background.');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [generatedVideoUrl, setGeneratedVideoUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [apiKeySelected, setApiKeySelected] = useState<boolean>(false);
  const { checkLimit, incrementUsage, showLoginModal } = useAuth();

  const checkApiKey = useCallback(async () => {
    if (window.aistudio) {
      const hasKey = await window.aistudio.hasSelectedApiKey();
      setApiKeySelected(hasKey);
      return hasKey;
    }
    return false;
  }, []);

  useEffect(() => {
    checkApiKey();
  }, [checkApiKey]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      await window.aistudio.openSelectKey();
      setApiKeySelected(true); 
    }
  };

  const handleGenerateVideo = async () => {
    if (!checkLimit('video')) {
        showLoginModal();
        return;
    }
    if (!sourceImage || !prompt) {
      setError('Please provide a source image and a prompt.');
      return;
    }
    const hasKey = await checkApiKey();
    if(!hasKey) {
       setError('API Key not selected. Please select an API key to generate videos.');
       return;
    }
    if (!process.env.API_KEY) {
      setError('API key is not configured.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setGeneratedVideoUrl(null);
    let messageIndex = 0;
    setLoadingMessage(LOADING_MESSAGES[messageIndex]);
    const messageInterval = setInterval(() => {
      messageIndex = (messageIndex + 1) % LOADING_MESSAGES.length;
      setLoadingMessage(LOADING_MESSAGES[messageIndex]);
    }, 5000);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: { imageBytes: sourceImage.base64, mimeType: sourceImage.mimeType },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio }
      });

      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation });
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        const videoBlob = await videoResponse.blob();
        setGeneratedVideoUrl(URL.createObjectURL(videoBlob));
        incrementUsage('video');
      } else {
        throw new Error('Video generation completed, but no download link was found.');
      }
    } catch (err: any) {
      if (err.message?.includes('Requested entity was not found')) {
        setError('API Key is invalid or not found. Please select a valid key.');
        setApiKeySelected(false);
      } else {
        setError(`An error occurred during video generation: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      clearInterval(messageInterval);
    }
  };
  
  const handleDownload = () => {
      if (generatedVideoUrl) {
          const link = document.createElement('a');
          link.href = generatedVideoUrl;
          link.download = `generated-video-${sourceImage?.name || 'promo'}.mp4`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
      }
  };

  return (
    <div className="flex flex-col gap-6">
      {!apiKeySelected && (
         <div className="bg-blue-900/50 border border-blue-700 text-blue-200 px-4 py-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
            <KeyRound size={40} className="text-blue-400 flex-shrink-0" />
            <div className="flex-grow">
              <h3 className="font-bold">API Key Required for Video Generation</h3>
              <p className="text-sm">Veo video generation requires you to select your own API key. Billing is associated with your Google Cloud project.</p>
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:underline text-sm">Learn more about billing.</a>
            </div>
            <button onClick={handleSelectKey} className="bg-brand-light hover:bg-brand-secondary text-white font-bold py-2 px-4 rounded-md transition-colors w-full sm:w-auto flex-shrink-0">
              Select API Key
            </button>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-base-200 p-4 rounded-lg flex flex-col gap-4">
          <h2 className="text-xl font-bold text-white">Video Controls</h2>
          <div>
            <label htmlFor="prompt" className="block text-sm font-medium text-content-200 mb-1">Prompt</label>
            <textarea id="prompt" rows={4} value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="e.g., A cinematic fly-around of the product..." className="w-full bg-base-300 border border-base-100 text-content-100 rounded-md p-2 focus:ring-2 focus:ring-brand-light focus:outline-none" disabled={isLoading || !sourceImage || !apiKeySelected} />
          </div>
          <div>
            <label className="block text-sm font-medium text-content-200 mb-1">Aspect Ratio</label>
            <div className="flex gap-2">
              <button onClick={() => setAspectRatio('16:9')} disabled={isLoading} className={`flex-1 p-2 rounded-md ${aspectRatio === '16:9' ? 'bg-brand-secondary text-white' : 'bg-base-300 hover:bg-gray-600'}`}>16:9 (Landscape)</button>
              <button onClick={() => setAspectRatio('9:16')} disabled={isLoading} className={`flex-1 p-2 rounded-md ${aspectRatio === '9:16' ? 'bg-brand-secondary text-white' : 'bg-base-300 hover:bg-gray-600'}`}>9:16 (Portrait)</button>
            </div>
          </div>
          <button onClick={handleGenerateVideo} disabled={isLoading || !sourceImage || !apiKeySelected} className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-secondary transition-colors duration-200 disabled:bg-base-300 disabled:cursor-not-allowed disabled:text-content-200">
            {isLoading ? <Loader className="animate-spin h-5 w-5" /> : <Film size={20} />}
            <span>Generate Video</span>
          </button>
        </div>
        <div className="bg-base-200 p-4 rounded-lg flex flex-col">
           <div className="flex justify-between items-center mb-2">
             <h2 className="text-xl font-bold text-white">Result</h2>
             <button onClick={handleDownload} disabled={!generatedVideoUrl || isLoading} className="flex items-center gap-2 px-3 py-1 bg-base-300 rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-brand-dark text-sm"><Download size={16}/> Download</button>
           </div>
          <div className="flex-grow bg-base-100 rounded-md min-h-[300px] md:min-h-[400px] flex justify-center items-center">
             {isLoading ? <div className="flex flex-col items-center text-content-200 p-4 text-center"><Loader className="animate-spin h-12 w-12 mb-4" /><span className="font-semibold text-lg">Generating Video...</span><span className="text-sm mt-2">{loadingMessage}</span></div>
            : generatedVideoUrl ? <video src={generatedVideoUrl} controls autoPlay loop className="max-w-full max-h-full rounded-md" />
            : <div className="text-center text-content-200">{!sourceImage ? <p>Please upload an image in the Photo Editor tab first.</p> : <><Video size={64} className="mx-auto mb-4" /><p>Your generated video will appear here.</p></>}</div>}
          </div>
        </div>
      </div>
      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2 mt-4"><AlertCircle size={20} /><span>{error}</span></div>}
    </div>
  );
};
