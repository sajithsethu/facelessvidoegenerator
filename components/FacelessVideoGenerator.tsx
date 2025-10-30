import React, { useState, useRef } from 'react';
import { GoogleGenAI, Modality, Type } from '@google/genai';
import { Bot, Loader, AlertCircle, Sparkles, Download, FileText, Tags, Mic } from 'lucide-react';
import { useAuth } from './Auth';
import { decode, decodeAudioData } from '../utils/audioUtils';
import { assembleVideo } from '../utils/videoCreationUtils';

interface Scene {
  scene: number;
  narration: string;
  visual_prompt: string;
}

interface ScriptData {
  title: string;
  script: Scene[];
  youtube_title: string;
  youtube_description: string;
  youtube_tags: string[];
}

interface GeneratedImage {
    base64: string;
    mimeType: string;
}

const ProgressIndicator: React.FC<{ message: string, step: number, totalSteps: number }> = ({ message, step, totalSteps }) => (
    <div className="w-full bg-base-300 rounded-full p-2">
        <div className="bg-brand-primary text-xs font-medium text-blue-100 text-center p-1 leading-none rounded-full" style={{ width: `${(step / totalSteps) * 100}%` }}>
           {message} ({step}/{totalSteps})
        </div>
    </div>
);


export const FacelessVideoGenerator: React.FC = () => {
  const [title, setTitle] = useState<string>('Top 5 Future AI Technologies');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState({ step: 0, message: '' });
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
      scriptData: ScriptData | null,
      videoUrl: string | null
  }>({ scriptData: null, videoUrl: null });
  const { checkLimit, incrementUsage, showLoginModal } = useAuth();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const TOTAL_STEPS = 4; // Script, Images, Audio, Assembly

  const handleGenerate = async () => {
    if (!checkLimit('facelessVideo')) {
        showLoginModal();
        return;
    }
    if (!title) {
        setError('Please enter a video title or topic.');
        return;
    }
    if (!process.env.API_KEY) {
        setError('API key is not configured.');
        return;
    }

    setIsLoading(true);
    setError(null);
    setResult({ scriptData: null, videoUrl: null });
    // @ts-ignore
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // Step 1: Generate Script & SEO
      setProgress({ step: 1, message: 'Writing script...' });
      const scriptData = await generateScript(ai, title);
      setResult(prev => ({ ...prev, scriptData }));

      // Step 2: Generate Images
      setProgress({ step: 2, message: 'Generating visuals...' });
      const images = await generateImages(ai, scriptData.script);

      // Step 3: Generate Audio
      setProgress({ step: 3, message: 'Creating voiceover...' });
      const fullNarration = scriptData.script.map(s => s.narration).join(' ');
      const audioBuffer = await generateAudio(ai, fullNarration);
      
      // Step 4: Assemble Video
      setProgress({ step: 4, message: 'Assembling video...' });
      const videoBlob = await assembleVideo(images, audioBuffer, audioContextRef.current);
      const videoUrl = URL.createObjectURL(videoBlob);
      
      setResult(prev => ({ ...prev, videoUrl }));
      incrementUsage('facelessVideo');

    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
      setProgress({ step: 0, message: '' });
      audioContextRef.current?.close();
    }
  };
  
  const generateScript = async (ai: GoogleGenAI, topic: string): Promise<ScriptData> => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-pro",
        contents: `Create a complete YouTube video script about "${topic}". The script should be engaging, informative, and structured for a faceless video. Analyze Google Trends and popular search topics to ensure the content is relevant. Provide a catchy title, a detailed description, and relevant tags. The script should be broken down into scenes, each with narration and a clear visual prompt for an AI image generator.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              script: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    scene: { type: Type.NUMBER },
                    narration: { type: Type.STRING },
                    visual_prompt: { type: Type.STRING }
                  },
                  required: ["scene", "narration", "visual_prompt"]
                }
              },
              youtube_title: { type: Type.STRING },
              youtube_description: { type: Type.STRING },
              youtube_tags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "script", "youtube_title", "youtube_description", "youtube_tags"]
          },
        },
      });
      return JSON.parse(response.text);
  };
  
  const generateImages = async (ai: GoogleGenAI, scenes: Scene[]): Promise<GeneratedImage[]> => {
      const imagePromises = scenes.map(scene => 
          ai.models.generateContent({
              model: 'gemini-2.5-flash-image',
              contents: { parts: [{ text: `A cinematic, high-resolution image for a YouTube video: ${scene.visual_prompt}` }] },
              config: { responseModalities: [Modality.IMAGE] },
          })
      );
      const responses = await Promise.all(imagePromises);
      return responses.map(res => {
          const part = res.candidates?.[0]?.content?.parts?.[0];
          if (part?.inlineData) {
              return { base64: part.inlineData.data, mimeType: part.inlineData.mimeType };
          }
          throw new Error('Image generation failed for a scene.');
      });
  };

  const generateAudio = async (ai: GoogleGenAI, narration: string): Promise<AudioBuffer> => {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Read with a clear, engaging, and professional tone for a YouTube video: ${narration}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
        },
      });
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio || !audioContextRef.current) throw new Error("Audio generation failed.");

      const decodedAudio = decode(base64Audio);
      return decodeAudioData(decodedAudio, audioContextRef.current, 24000, 1);
  };
  

  return (
    <div className="flex flex-col gap-6">
      <div className="bg-base-200 p-6 rounded-lg">
        <div className="flex items-center gap-3 mb-4">
          <Bot size={28} className="text-brand-light"/>
          <h2 className="text-2xl font-bold text-white">AI Faceless Video Generator</h2>
        </div>
        <p className="text-content-200 mb-4">Enter a video title or topic, and our AI will handle the rest—script, visuals, voiceover, and final video assembly.</p>
        <div className="flex flex-col sm:flex-row gap-4">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., The History of Space Exploration" className="w-full flex-grow bg-base-300 border border-base-100 text-content-100 rounded-md px-4 py-2 focus:ring-2 focus:ring-brand-light focus:outline-none" disabled={isLoading}/>
          <button onClick={handleGenerate} disabled={isLoading || !title} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand-primary text-white font-bold py-2 px-6 rounded-md hover:bg-brand-secondary transition-colors duration-200 disabled:bg-base-300 disabled:cursor-not-allowed disabled:text-content-200">
            {isLoading ? <Loader className="animate-spin h-5 w-5" /> : <Sparkles size={20} />}
            <span>Generate Video</span>
          </button>
        </div>
      </div>
      
      {isLoading && <ProgressIndicator message={progress.message} step={progress.step} totalSteps={TOTAL_STEPS} />}
      {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle size={20} /><span>{error}</span></div>}

      {result.videoUrl && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-base-200 p-4 rounded-lg">
             <div className="flex justify-between items-center mb-2">
                 <h3 className="text-xl font-bold text-white">Generated Video</h3>
                 <a href={result.videoUrl} download={`${result.scriptData?.youtube_title.replace(/ /g, '_') || 'video'}.mp4`} className="flex items-center gap-2 px-3 py-1 bg-base-300 rounded-md hover:bg-brand-dark text-sm"><Download size={16}/> Download</a>
            </div>
            <video src={result.videoUrl} controls autoPlay loop className="w-full rounded-md bg-black" />
          </div>
          <div className="bg-base-200 p-4 rounded-lg flex flex-col gap-4">
            <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><FileText size={20}/> SEO Title</h3>
                <p className="text-content-200 bg-base-300 p-2 rounded-md mt-1">{result.scriptData?.youtube_title}</p>
            </div>
             <div>
                <h3 className="text-lg font-bold text-white flex items-center gap-2"><Tags size={20}/> SEO Tags</h3>
                <div className="flex flex-wrap gap-2 mt-1">
                    {result.scriptData?.youtube_tags.map(tag => <span key={tag} className="bg-base-300 text-sm px-2 py-1 rounded">{tag}</span>)}
                </div>
            </div>
          </div>
        </div>
      )}

      {result.scriptData && (
          <div className="bg-base-200 p-4 rounded-lg">
              <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Mic size={20} /> Full Script & Visuals</h3>
              <div className="max-h-96 overflow-y-auto space-y-4 pr-2">
                  {result.scriptData.script.map(scene => (
                      <div key={scene.scene} className="bg-base-300 p-3 rounded-md">
                          <p className="font-bold text-brand-light">Scene {scene.scene}</p>
                          <p className="text-content-100 my-1"><span className="font-semibold">Narration:</span> {scene.narration}</p>
                          <p className="text-content-200 text-sm"><span className="font-semibold">Visual:</span> {scene.visual_prompt}</p>
                      </div>
                  ))}
              </div>
          </div>
      )}
    </div>
  );
};
