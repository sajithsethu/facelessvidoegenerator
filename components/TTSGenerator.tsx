import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { Loader, AlertCircle, Play, Pause, Mic, Download } from 'lucide-react';
import { decode, decodeAudioData, audioBufferToWav } from '../utils/audioUtils';
import { useAuth } from './Auth';

type Voice = 'Kore' | 'Puck' | 'Zephyr' | 'Charon' | 'Fenrir';

export const TTSGenerator: React.FC = () => {
  const [text, setText] = useState<string>('Introducing the all-new product, designed for excellence and crafted with passion. Experience the difference today.');
  const [voice, setVoice] = useState<Voice>('Zephyr');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedAudio, setGeneratedAudio] = useState<AudioBuffer | null>(null);
  const { checkLimit, incrementUsage, showLoginModal } = useAuth();
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    // @ts-ignore
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
    return () => {
        audioContextRef.current?.close();
    }
  }, []);

  const stopPlayback = useCallback(() => {
    if (audioSourceRef.current) {
      audioSourceRef.current.stop();
      audioSourceRef.current.disconnect();
      audioSourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleGenerate = async () => {
    if (!checkLimit('audio')) {
        showLoginModal();
        return;
    }
    if (!text) {
      setError('Please enter some text to generate audio.');
      return;
    }
    if (!process.env.API_KEY) {
      setError('API key is not configured.');
      return;
    }

    stopPlayback();
    setGeneratedAudio(null);
    setIsLoading(true);
    setError(null);

    try {
      if (!audioContextRef.current) throw new Error("Audio context not initialized");
      
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Say with a professional and engaging tone: ${text}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
        },
      });
      
      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error("No audio data received from API.");

      const decodedAudio = decode(base64Audio);
      const audioBuffer = await decodeAudioData(decodedAudio, audioContextRef.current, 24000, 1);
      
      setGeneratedAudio(audioBuffer);
      incrementUsage('audio');
      return audioBuffer;

    } catch (err: any) {
      setError(`An error occurred: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
    return null;
  };

  const playAudio = (buffer: AudioBuffer) => {
      if (audioContextRef.current) {
        stopPlayback();
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContextRef.current.destination);
        source.onended = () => setIsPlaying(false);
        source.start();

        audioSourceRef.current = source;
        setIsPlaying(true);
      }
  };

  const handleGenerateAndPlay = async () => {
      const buffer = await handleGenerate();
      if (buffer) {
          playAudio(buffer);
      }
  }

  const handlePlaybackToggle = () => {
    if (isPlaying) {
      stopPlayback();
    } else if (generatedAudio) {
      playAudio(generatedAudio);
    } else {
        handleGenerateAndPlay();
    }
  };

  const handleDownload = () => {
      if (generatedAudio) {
          const wavBlob = audioBufferToWav(generatedAudio);
          const url = URL.createObjectURL(wavBlob);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'generated-audio.wav';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
      }
  }

  const voices: Voice[] = ['Zephyr', 'Kore', 'Puck', 'Charon', 'Fenrir'];

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 p-6 bg-base-200 rounded-lg">
      <div className="flex items-center gap-3">
        <Mic size={28} className="text-brand-light"/>
        <h2 className="text-2xl font-bold text-white">Audio Creator</h2>
      </div>

      <div>
        <label htmlFor="tts-text" className="block text-sm font-medium text-content-200 mb-1">Product Description or Script</label>
        <textarea id="tts-text" rows={5} value={text} onChange={(e) => setText(e.target.value)} placeholder="Enter text to convert to speech..." className="w-full bg-base-300 border border-base-100 text-content-100 rounded-md p-2 focus:ring-2 focus:ring-brand-light focus:outline-none" disabled={isLoading} />
      </div>
       <div>
        <label htmlFor="voice-select" className="block text-sm font-medium text-content-200 mb-1">Voice</label>
        <select id="voice-select" value={voice} onChange={(e) => setVoice(e.target.value as Voice)} disabled={isLoading} className="w-full bg-base-300 border border-base-100 text-content-100 rounded-md p-2 focus:ring-2 focus:ring-brand-light focus:outline-none">
            {voices.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
       </div>
       
       {error && <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg flex items-center gap-2"><AlertCircle size={20} /><span>{error}</span></div>}

      <div className="mt-2 flex flex-col sm:flex-row gap-3">
        <button onClick={handlePlaybackToggle} disabled={isLoading || !text} className="w-full flex items-center justify-center gap-3 bg-brand-primary text-white font-bold py-3 px-6 rounded-md hover:bg-brand-secondary transition-colors duration-200 disabled:bg-base-300 disabled:cursor-not-allowed disabled:text-content-200">
          {isLoading ? <><Loader className="animate-spin h-6 w-6" /><span>Generating...</span></>
          : isPlaying ? <><Pause size={24} /><span>Stop</span></>
          : <><Play size={24} /><span>{generatedAudio ? 'Play' : 'Generate & Play'}</span></>}
        </button>
        <button onClick={handleDownload} disabled={!generatedAudio || isLoading} className="w-full sm:w-auto flex items-center justify-center gap-2 bg-base-300 text-white font-bold py-3 px-6 rounded-md hover:bg-brand-dark transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed">
            <Download size={20} />
            <span>Download</span>
        </button>
      </div>
    </div>
  );
};
