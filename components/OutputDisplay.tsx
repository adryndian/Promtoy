
import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset, Scene } from '../types';
import { generateSpeech, getWavBlob, analyzeVoiceStyle, generateImagePreview, generateVideo } from '../services/geminiService';
import { generateImageHuggingFace, generateVideoHuggingFace, generateImageCloudflare } from '../services/externalService';
import { generateImageTogether, generateImageDashscope, generateVideoDashscope } from '../services/multiProviderService';
import { generateImageBedrock, generateSpeechBedrock } from '../services/awsService';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, ElevenLabsVoice, ELEVENLABS_MODELS, ElevenLabsSettings } from '../services/elevenLabsService';
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Image, Settings2, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, Film, Wand2, Video as VideoIcon, Volume2, SlidersHorizontal, Info, FileText, FileJson, Printer, Headphones, Palette, Aperture, Layers, Split, Smile, ChevronDown, ChevronUp, Lightbulb, Target, Shield, Users, Brain, Megaphone, RefreshCw, ChevronRight } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const SPEECH_STYLES = [
  'Natural',
  'Excited',
  'Serious',
  'Whispering',
  'Shouting',
  'Fast-paced',
  'Slow & Deliberate',
  'Friendly'
];

const POLLY_VOICES = ['Joanna', 'Matthew', 'Ivy', 'Justin', 'Joey', 'Salli', 'Kimberly', 'Kendra', 'Raveena', 'Aditi', 'Emma', 'Brian', 'Amy', 'Arthur'];

type AspectRatio = "9:16" | "16:9" | "1:1";
type TTSProvider = 'gemini' | 'elevenlabs' | 'aws';

interface OutputDisplayProps {
    data: GeneratedAsset | null;
    modelUsed?: string;
    imageModelUsed?: string;
    onUpdate?: (updatedData: GeneratedAsset) => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ data, modelUsed, imageModelUsed, onUpdate }) => {
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  
  // Audio/Image cache
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});
  const [previewVideos, setPreviewVideos] = useState<Record<string, string>>({});
  
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  // Variation State
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);

  // Strategy Section State
  const [showStrategy, setShowStrategy] = useState(false);

  // TTS State
  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('gemini');
  const [activeVoice, setActiveVoice] = useState<string>('Kore'); // Default Gemini Voice
  const [speechStyle, setSpeechStyle] = useState<string>('Natural');
  
  // ElevenLabs State
  const [elevenLabsVoices, setElevenLabsVoices] = useState<ElevenLabsVoice[]>([]);
  const [hasElevenLabsKey, setHasElevenLabsKey] = useState(false);
  const [showElTuning, setShowElTuning] = useState(false);
  const [elSettings, setElSettings] = useState<ElevenLabsSettings>({
      model_id: 'eleven_multilingual_v2',
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.0,
      use_speaker_boost: true
  });
  
  // Media Generation State
  const [loadingImageIdx, setLoadingImageIdx] = useState<number | null>(null);
  const [loadingVideoIdx, setLoadingVideoIdx] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  
  // Studio Settings (Models)
  const [activeImageModel, setActiveImageModel] = useState<string>('gemini-2.5-flash-image');
  const [activeVideoModel, setActiveVideoModel] = useState<string>('veo-3.1-fast-generate-preview');

  // View Modal State
  const [viewModalContent, setViewModalContent] = useState<{type: 'image' | 'video', url: string} | null>(null);
  
  // Settings State
  const [showSettings, setShowSettings] = useState(false);

  // Custom Voice State (Gemini only)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [customVoiceTone, setCustomVoiceTone] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hydrate state
  useEffect(() => {
    if (data) {
        const initialAudioUrls: Record<string, string> = {};
        const initialImages: Record<string, string> = {};
        
        const populateCache = (scenes: Scene[], varIndex: number) => {
             scenes.forEach((scene, idx) => {
                const key = `${varIndex}-${idx}`;
                if (scene.generated_audio) initialAudioUrls[key] = scene.generated_audio;
                if (scene.generated_image) initialImages[key] = scene.generated_image;
             });
        };

        if (data.variations && data.variations.length > 0) {
             data.variations.forEach((v, i) => populateCache(v.scenes, i));
        } else if (data.scenes) {
             populateCache(data.scenes, 0);
        }
        
        setAudioUrls(initialAudioUrls);
        setPreviewImages(initialImages);
    }
  }, [data]);

  // Initial Logic & ElevenLabs Fetch
  useEffect(() => {
    const key = localStorage.getItem('ELEVENLABS_API_KEY');
    if (key) {
        setHasElevenLabsKey(true);
        fetchElevenLabsVoices().then(voices => {
            setElevenLabsVoices(voices);
            if (voices.length > 0 && ttsProvider === 'elevenlabs') {
                 const defaultVoice = voices.find(v => v.name === "Rachel" || v.name === "Adam") || voices[0];
                 setActiveVoice(defaultVoice.voice_id);
            }
        });
    }

    if (imageModelUsed) setActiveImageModel(imageModelUsed);

    if (data) {
        const dna = data.brand_dna;
        const traits = dna?.voice_traits?.map(t => t.toLowerCase()) || [];
        const audience = dna?.audience_guess?.toLowerCase() || '';

        let recommendedGemini = 'Kore';
        if (audience.includes('male') || audience.includes('men') || traits.some(t => ['deep', 'authoritative', 'bold', 'assertive'].includes(t))) {
            recommendedGemini = 'Fenrir';
        }
        
        if (activeVoice === 'Kore' && ttsProvider === 'gemini') {
            setActiveVoice(recommendedGemini);
        }
    }
  }, [data]);

  const getActiveScenes = (): Scene[] => {
      if (!data) return [];
      if (data.variations && data.variations.length > 0) {
          return data.variations[activeVariationIndex]?.scenes || [];
      }
      return data.scenes || [];
  };

  const getActiveVariationName = (): string => {
      if (!data?.variations?.length) return "Original Script";
      return data.variations[activeVariationIndex].name;
  }

  const handleProviderChange = (provider: TTSProvider) => {
      setTtsProvider(provider);
      
      if (provider === 'gemini') {
          setActiveVoice('Kore');
      } else if (provider === 'aws') {
          setActiveVoice('Joanna');
      } else if (provider === 'elevenlabs' && elevenLabsVoices.length > 0) {
           setActiveVoice(elevenLabsVoices[0].voice_id);
      } else if (provider === 'elevenlabs' && !hasElevenLabsKey) {
          alert("Please add your ElevenLabs API Key in settings first.");
          setShowSettings(true);
          setTtsProvider('gemini');
      }
  };

  const handleVoiceChange = (newVoice: string) => {
    setActiveVoice(newVoice);
    if (activeAudio) {
      activeAudio.pause();
      setActiveAudio(null);
    }
    setPlayingIdx(null);
  };

  const handleStyleChange = (style: string) => {
    setSpeechStyle(style);
    if (activeAudio) {
        activeAudio.pause();
        setActiveAudio(null);
    }
    setPlayingIdx(null);
  }

  const handleElSettingChange = (field: keyof ElevenLabsSettings, value: any) => {
      setElSettings(prev => ({...prev, [field]: value}));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingVoice(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64Audio = (reader.result as string).split(',')[1];
            const analyzedTone = await analyzeVoiceStyle(base64Audio);
            setCustomVoiceTone(analyzedTone);
            if (ttsProvider !== 'gemini') {
                setTtsProvider('gemini'); // Force switch back to Gemini for tone cloning features
                alert("Switched to Gemini TTS to support voice tone cloning.");
            } else {
                alert(`Voice Clone Active: Style adapted to "${analyzedTone}"`);
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error("Voice analysis failed", err);
        alert("Could not analyze voice sample.");
    } finally {
        setIsProcessingVoice(false);
    }
  };

  const handleTogglePlay = async (text: string, idx: number) => {
    if (playingIdx === idx && activeAudio) {
      activeAudio.pause();
      setPlayingIdx(null);
      return;
    }
    if (activeAudio) {
      activeAudio.pause();
      setPlayingIdx(null);
    }
    setLoadingIdx(idx);

    const cacheKey = `${activeVariationIndex}-${idx}`;

    try {
      let url = audioUrls[cacheKey];
      
      if (!url) {
        if (ttsProvider === 'gemini') {
             const tone = customVoiceTone || (speechStyle !== 'Natural' ? `Speak in a ${speechStyle} tone` : undefined);
             const b64 = await generateSpeech(text, activeVoice, tone);
             const blob = getWavBlob(b64);
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        } else if (ttsProvider === 'aws') {
             const b64 = await generateSpeechBedrock(text, activeVoice);
             url = b64; // Already base64 data URI
        } else {
             const blobUrl = await generateElevenLabsSpeech(text, activeVoice, elSettings);
             const blob = await fetch(blobUrl).then(r => r.blob());
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        }
        
        setAudioUrls(prev => ({ ...prev, [cacheKey]: url }));
        
        if (data && onUpdate) {
            const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
            if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                 updatedData.variations[activeVariationIndex].scenes[idx].generated_audio = url;
            } else if (updatedData.scenes) {
                 updatedData.scenes[idx].generated_audio = url;
            }
            onUpdate(updatedData);
        }
      }
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPlayingIdx(null);
        setActiveAudio(null);
      };
      
      try {
        await audio.play();
        setActiveAudio(audio);
        setPlayingIdx(idx);
      } catch (playErr) {
        console.warn("Auto-play blocked after generation.", playErr);
      }
      
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Error generating audio.");
    } finally {
      setLoadingIdx(null);
    }
  };

  const handleGeneratePreview = async (scene: Scene, idx: number) => {
      if (loadingImageIdx !== null) return;
      setLoadingImageIdx(idx);
      const cacheKey = `${activeVariationIndex}-${idx}`;
      
      // Prefer new structured image prompt, fallback to legacy
      const promptToUse = scene.media_prompt_details?.image_prompt || scene.image_prompt || scene.visual_description;

      try {
          let imageUrl = "";
          
          if (activeImageModel === 'cf-flux-schnell') {
               imageUrl = await generateImageCloudflare(promptToUse);
          } else if (activeImageModel.startsWith('aws-') || activeImageModel.startsWith('amazon.') || activeImageModel.startsWith('stability.')) {
               // Map short names to full IDs if needed, or pass through
               let modelId = activeImageModel;
               if (activeImageModel === 'aws-titan') modelId = "amazon.titan-image-generator-v2:0";
               if (activeImageModel === 'aws-sdxl') modelId = "stability.stable-diffusion-xl-v1:0";
               if (activeImageModel === 'aws-sd3') modelId = "stability.sd3-large-v1:0";
               if (activeImageModel === 'aws-ultra') modelId = "stability.stable-image-ultra-v1:0";
               
               imageUrl = await generateImageBedrock(promptToUse, modelId);
          } else if (activeImageModel === 'together-flux') {
              imageUrl = await generateImageTogether(promptToUse);
          } else if (activeImageModel === 'dashscope-wanx') {
              imageUrl = await generateImageDashscope(promptToUse);
          } else if (activeImageModel.startsWith('hf-')) {
              const hfModel = activeImageModel === 'hf-sdxl' ? "stabilityai/stable-diffusion-xl-base-1.0" : "black-forest-labs/FLUX.1-dev";
              imageUrl = await generateImageHuggingFace(promptToUse, hfModel);
          } else {
              imageUrl = await generateImagePreview(promptToUse, aspectRatio, activeImageModel);
          }

          if (imageUrl) {
              setPreviewImages(prev => ({ ...prev, [cacheKey]: imageUrl }));
              if (data && onUpdate) {
                const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
                if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                     updatedData.variations[activeVariationIndex].scenes[idx].generated_image = imageUrl;
                } else if (updatedData.scenes) {
                     updatedData.scenes[idx].generated_image = imageUrl;
                }
                onUpdate(updatedData);
              }
          } else {
              alert("Failed to generate preview image.");
          }
      } catch (e) {
          console.error(e);
          alert(e instanceof Error ? e.message : "Image generation failed");
      } finally {
          setLoadingImageIdx(null);
      }
  };

  const handleGenerateVideo = async (scene: Scene, idx: number) => {
     if (loadingVideoIdx !== null) return;
     setLoadingVideoIdx(idx);
     const cacheKey = `${activeVariationIndex}-${idx}`;
     
     // Prefer new structured video prompt, fallback to legacy or visual description
     const promptToUse = scene.media_prompt_details?.video_prompt || scene.video_prompt || scene.visual_description;

     try {
         let videoUrl = "";
         if (activeVideoModel === 'hf-cogvideo') {
             // Fallback to HF video logic if model selected
             videoUrl = await generateVideoHuggingFace(promptToUse); 
         } else if (activeVideoModel === 'dashscope-wanx-video') {
             videoUrl = await generateVideoDashscope(promptToUse);
         } else {
             // Default Veo (Gemini) - Pass activeVideoModel (e.g. 'veo-3.1-generate-preview' or 'veo-3.1-fast-generate-preview')
             videoUrl = await generateVideo(promptToUse, activeVideoModel);
         }

         if (videoUrl) {
             setPreviewVideos(prev => ({ ...prev, [cacheKey]: videoUrl }));
         }
     } catch (e) {
         console.error(e);
         alert(e instanceof Error ? e.message : "Video generation failed");
     } finally {
         setLoadingVideoIdx(null);
     }
  };

  const handleDownload = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyToClipboard = (label: string, content: any) => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedSection(label);
      setTimeout(() => setCopiedSection(null), 2000);
    }).catch(err => {
      console.error("Clipboard access denied:", err);
      alert("Cannot copy to clipboard. Please allow clipboard permissions or copy manually.");
    });
  };

  const handleExportJSON = () => {
    if (!data) return;
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.concept_title.replace(/\s+/g, '_')}_script.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTXT = () => {
    if (!data) return;
    let txt = `TITLE: ${data.concept_title}\n`;
    txt += `HOOK: ${data.hook_rationale}\n`;
    txt += `ANGLE: ${data.analysis_report?.winning_angle_logic}\n\n`;
    
    // Export Active Variation
    txt += `--- SCRIPT (${getActiveVariationName()}) ---\n\n`;
    const scenes = getActiveScenes();
    scenes.forEach((scene, i) => {
        txt += `SCENE ${i + 1} (${scene.seconds}s)\n`;
        txt += `VISUAL: ${scene.visual_description}\n`;
        txt += `AUDIO: ${scene.audio_script}\n`;
        txt += `TEXT OVERLAY: ${scene.on_screen_text}\n\n`;
    });
    
    const blob = new Blob([txt], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${data.concept_title.replace(/\s+/g, '_')}_script.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  const handlePrint = () => {
    if (!data) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return alert("Please allow popups to print");
    
    const scenes = getActiveScenes();

    const html = `
      <html>
        <head>
          <title>${data.concept_title}</title>
          <style>
            body { font-family: sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; }
            h1 { font-size: 24px; margin-bottom: 10px; }
            .meta { color: #64748b; font-size: 14px; margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
            .scene { margin-bottom: 30px; page-break-inside: avoid; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; }
            .scene-header { font-weight: bold; font-size: 14px; color: #f97316; margin-bottom: 10px; text-transform: uppercase; }
            .label { font-weight: bold; font-size: 12px; color: #94a3b8; text-transform: uppercase; margin-top: 10px; display: block; }
            p { margin-top: 4px; line-height: 1.5; }
            @media print {
               body { padding: 0; }
               .scene { border: none; border-bottom: 1px solid #e2e8f0; border-radius: 0; }
            }
          </style>
        </head>
        <body>
          <h1>${data.concept_title}</h1>
          <div class="meta">
            <p><strong>Variation:</strong> ${getActiveVariationName()}</p>
            <p><strong>Hook:</strong> ${data.hook_rationale}</p>
            <p><strong>Winning Angle:</strong> ${data.analysis_report?.winning_angle_logic}</p>
            <p><strong>Duration:</strong> ${scenes.reduce((acc, s) => acc + (parseInt(s.seconds) || 0), 0) || 0}s est.</p>
          </div>
          
          ${scenes.map((scene, i) => `
            <div class="scene">
              <div class="scene-header">Scene ${i+1} • ${scene.seconds}s</div>
              
              <span class="label">Visual</span>
              <p>${scene.visual_description}</p>
              
              <span class="label">Audio</span>
              <p>"${scene.audio_script}"</p>
              
              <span class="label">Overlay</span>
              <p>${scene.on_screen_text}</p>
            </div>
          `).join('')}
          
          <script>
            window.onload = () => { window.print(); }
          </script>
        </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
  };

  if (!data) return (
    <div className="h-full flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-3xl bg-white/40 p-8">
      <Clapperboard className="w-12 h-12 mb-4 opacity-30 text-slate-500" />
      <p className="font-medium text-center">Waiting for director's input...</p>
    </div>
  );

  const scenes = getActiveScenes();
  const isPartial = !scenes || scenes.length === 0;

  return (
    <div className="space-y-6 animate-in pb-12 w-full max-w-full">
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* ElevenLabs Tuning Modal */}
      {showElTuning && (
          <div className="fixed inset-0 z-[100] bg-white/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
             <div className="bg-white border border-slate-200 shadow-2xl rounded-2xl w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div className="flex items-center gap-2">
                         <SlidersHorizontal className="w-4 h-4 text-orange-500" />
                         <h3 className="font-bold text-slate-800">Voice Tuning</h3>
                    </div>
                    <button onClick={() => setShowElTuning(false)} className="p-1 hover:bg-slate-200 rounded-full text-slate-500"><X className="w-4 h-4"/></button>
                </div>
                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Model</label>
                        <select 
                            value={elSettings.model_id}
                            onChange={(e) => handleElSettingChange('model_id', e.target.value)}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 outline-none focus:border-orange-500"
                        >
                            {ELEVENLABS_MODELS.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>
                    {/* ... (Keep existing Tuning UI) ... */}
                    <button 
                        onClick={() => setShowElTuning(false)}
                        className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl shadow-lg shadow-slate-900/10 active:scale-95 transition-all"
                    >
                        Apply Settings
                    </button>
                </div>
             </div>
          </div>
      )}

      {/* Media Viewer Modal */}
      {viewModalContent && (
        <div className="fixed inset-0 z-[100] bg-white/95 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
           <button 
              onClick={() => setViewModalContent(null)}
              className="absolute top-4 right-4 p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors shadow-sm"
           >
              <X className="w-6 h-6" />
           </button>
           <div className="relative w-full max-w-5xl max-h-[90vh] flex flex-col items-center justify-center">
              {viewModalContent.type === 'image' ? (
                  <img src={viewModalContent.url} alt="Full view" className="max-w-full max-h-[80vh] rounded-lg shadow-2xl object-contain border border-slate-200" />
              ) : (
                  <video src={viewModalContent.url} controls autoPlay className="max-w-full max-h-[80vh] rounded-lg shadow-2xl border border-slate-200" />
              )}
              <div className="mt-6 flex gap-4">
                 <button 
                    onClick={() => handleDownload(viewModalContent.url, `ugc-generated-${Date.now()}.${viewModalContent.type === 'image' ? 'jpg' : 'mp4'}`)}
                    className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-brand-500/30 active:scale-95"
                 >
                    <Download className="w-5 h-5" /> Download {viewModalContent.type === 'image' ? 'Image' : 'Video'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* Title & Controls */}
      <div className="glass-panel p-5 md:p-8 rounded-3xl border-l-4 border-brand-500 bg-white relative overflow-hidden shadow-sm">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-lg bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 transition-colors"
          title="Configure AI Keys"
        >
          <Settings2 className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-12">
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2">{data.concept_title}</h2>
               <p className="text-slate-500 italic mb-4 text-sm md:text-base">"{data.hook_rationale}"</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
                <button onClick={handleExportTXT} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><FileText className="w-3.5 h-3.5" /> TXT</button>
                <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                <button onClick={handleExportJSON} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><FileJson className="w-3.5 h-3.5" /> JSON</button>
                <div className="w-px h-4 bg-slate-200 hidden sm:block"></div>
                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all"><Printer className="w-3.5 h-3.5" /> PDF</button>
            </div>
          </div>

          <div className="mt-4 -mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-3 min-w-max pb-1">
                
                {/* Voice Control Group */}
                <div className="flex items-center gap-3 text-xs text-brand-700 bg-brand-50 px-4 py-2 rounded-full border border-brand-200 whitespace-nowrap">
                <Mic className="w-3.5 h-3.5" />
                <div className="flex items-center gap-1 bg-white rounded p-0.5 border border-slate-200 shadow-sm">
                    <button onClick={() => handleProviderChange('gemini')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'gemini' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Gemini</button>
                    <button onClick={() => handleProviderChange('aws')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'aws' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>AWS Polly</button>
                    <button onClick={() => handleProviderChange('elevenlabs')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'elevenlabs' ? 'bg-orange-500/80 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>ElevenLabs</button>
                </div>
                <span className="text-brand-300">|</span>
                <div className="flex items-center gap-2">
                    <span className="text-brand-800/70 uppercase font-bold tracking-wider">Voice:</span>
                    <select value={activeVoice} onChange={(e) => handleVoiceChange(e.target.value)} className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors max-w-[100px] truncate">
                    {ttsProvider === 'gemini' ? GEMINI_VOICES.map(v => <option key={v} value={v} className="bg-white text-slate-800">{v}</option>) 
                    : ttsProvider === 'aws' ? POLLY_VOICES.map(v => <option key={v} value={v} className="bg-white text-slate-800">{v}</option>)
                    : elevenLabsVoices.length > 0 ? elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id} className="bg-white text-slate-800">{v.name}</option>)
                    : <option className="bg-white text-slate-400">Loading/No Key...</option>}
                    </select>
                </div>
                </div>

                {/* Studio Settings (Media Models) */}
                <div className="flex items-center gap-3 text-xs text-purple-700 bg-purple-50 px-4 py-2 rounded-full border border-purple-200 whitespace-nowrap">
                   <Aperture className="w-3.5 h-3.5" />
                   {/* Image Model Selector */}
                   <div className="flex items-center gap-2">
                       <span className="text-purple-800/70 uppercase font-bold tracking-wider">Image:</span>
                       <select 
                          value={activeImageModel}
                          onChange={(e) => setActiveImageModel(e.target.value)}
                          className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate"
                       >
                          <option value="gemini-3-pro-image-preview">Gemini 3 Pro</option>
                          <option value="gemini-2.5-flash-image">Gemini 2.5</option>
                          <option value="imagen-3.0-generate-001">Imagen 3</option>
                          <option value="amazon.titan-image-generator-v2:0">AWS Titan v2</option>
                          <option value="amazon.nova-canvas-v1:0">AWS Nova Canvas</option>
                          <option value="stability.sd3-large-v1:0">AWS SD3 Large</option>
                          <option value="cf-flux-schnell">Cloudflare Flux</option>
                          <option value="hf-flux-dev">HuggingFace FLUX</option>
                          <option value="hf-sdxl">HuggingFace SDXL</option>
                          <option value="together-flux">Together FLUX</option>
                          <option value="dashscope-wanx">Dashscope Wanx</option>
                       </select>
                   </div>
                   <span className="text-purple-300">|</span>
                   {/* Video Model Selector */}
                   <div className="flex items-center gap-2">
                       <span className="text-purple-800/70 uppercase font-bold tracking-wider">Video:</span>
                       <select 
                          value={activeVideoModel}
                          onChange={(e) => setActiveVideoModel(e.target.value)}
                          className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate"
                       >
                          <option value="veo-3.1-fast-generate-preview">Veo Fast</option>
                          <option value="veo-3.1-generate-preview">Veo (Quality)</option>
                          <option value="hf-cogvideo">HF CogVideo</option>
                          <option value="dashscope-wanx-video">Dashscope Wanx</option>
                       </select>
                   </div>
                </div>

                {/* Visual Settings Group */}
                <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200">
                    <div className="flex items-center gap-1 pr-1">
                        {[{ val: "9:16", icon: Smartphone }, { val: "16:9", icon: Monitor }, { val: "1:1", icon: Tablet }].map(r => (
                            <button key={r.val} onClick={() => setAspectRatio(r.val as AspectRatio)} className={`p-1.5 rounded-full transition-all ${aspectRatio === r.val ? 'bg-white text-brand-600 shadow-sm border border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}><r.icon className="w-3.5 h-3.5" /></button>
                        ))}
                    </div>
                </div>

            </div>
          </div>
        </div>


      </div>
      
      {/* Strategy & Insights Section */}
      {data.analysis_report && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2">
            <button 
                onClick={() => setShowStrategy(!showStrategy)}
                className="w-full flex items-center justify-between p-4 md:p-5 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <Brain className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm md:text-base">Creative Strategy & Insights</h3>
                        <p className="text-xs text-slate-500">Why this concept works</p>
                    </div>
                </div>
                {showStrategy ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {showStrategy && (
                <div className="p-5 md:p-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Column 1: Analysis */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Target className="w-3.5 h-3.5" /> Winning Angle
                            </div>
                            <p className="text-slate-800 font-medium leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm">
                                {data.analysis_report.winning_angle_logic}
                            </p>
                        </div>
                        
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Users className="w-3.5 h-3.5" /> Target Audience
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed">
                                {data.analysis_report.audience_persona}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Shield className="w-3.5 h-3.5" /> Pain Points
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {data.analysis_report.core_pain_points.map((pt, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-md border border-red-100">
                                        {pt}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Column 2: Brand DNA */}
                    <div className="space-y-6">
                         <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Megaphone className="w-3.5 h-3.5" /> Voice & Tone
                            </div>
                            <div className="flex flex-wrap gap-2 mb-3">
                                {data.brand_dna?.voice_traits?.map((trait, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-md border border-purple-100">
                                        {trait}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 italic">
                                "Audience Guess: {data.brand_dna?.audience_guess}"
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Lightbulb className="w-3.5 h-3.5" /> Product Truths
                            </div>
                            <ul className="space-y-2">
                                {data.product_truth_sheet?.safe_benefit_phrases?.slice(0, 3).map((phrase, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                        <Check className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                        <span>{phrase}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}
        </div>
      )}

      {/* Variation Switcher */}
      {data.variations && data.variations.length > 1 && (
        <div className="flex items-center justify-center py-2">
            <div className="bg-slate-100 p-1 rounded-xl inline-flex shadow-inner">
                {data.variations.map((v, idx) => (
                    <button
                        key={v.id}
                        onClick={() => {
                            setActiveVariationIndex(idx);
                            setPlayingIdx(null);
                            if (activeAudio) {
                                activeAudio.pause();
                                setActiveAudio(null);
                            }
                        }}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                            activeVariationIndex === idx 
                            ? 'bg-white text-brand-600 shadow-sm ring-1 ring-black/5' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                        }`}
                    >
                        <span className="block text-xs font-normal opacity-70 mb-0.5">{v.hook_type}</span>
                        {v.name}
                    </button>
                ))}
            </div>
        </div>
      )}

      {/* Scenes */}
      {isPartial ? (
         <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
                <h3 className="text-slate-800 font-bold mb-1">Director is drafting scenes...</h3>
                <p className="text-xs text-slate-500">Writing scripts based on brand DNA: <span className="text-brand-600 font-medium">{data.brand_dna?.voice_traits?.join(', ')}</span></p>
            </div>
         </div>
      ) : (
        <div className="space-y-4">
            {scenes.map((scene: Scene, idx: number) => {
                const cacheKey = `${activeVariationIndex}-${idx}`;
                const structuredPrompts = scene.media_prompt_details;
                
                return (
                <div key={idx} className="group/card relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden">
                    {/* Scene Header / Ribbon */}
                    <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 group-hover/card:bg-brand-500 transition-colors"></div>
                    
                    <div className="p-5 md:p-7 pl-8 md:pl-10">
                        <div className="flex flex-col md:flex-row gap-8">
                            
                            {/* LEFT COLUMN: VISUALS & MEDIA */}
                            <div className="w-full md:w-5/12 space-y-5">
                                
                                {/* Header Mobile */}
                                <div className="flex md:hidden items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-black text-slate-300 uppercase tracking-widest">Scene {idx + 1}</span>
                                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full">{scene.seconds}s</span>
                                    </div>
                                </div>

                                {/* Media Preview Area */}
                                <div className={`relative w-full rounded-xl overflow-hidden bg-slate-900 shadow-inner border border-slate-200 group/media ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"}`}>
                                    
                                    {/* GENERATE BUTTONS OVERLAY (When Empty) */}
                                    {!previewVideos[cacheKey] && !previewImages[cacheKey] && !loadingImageIdx && !loadingVideoIdx && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-[2px] opacity-100 transition-opacity z-10 p-4 text-center">
                                            <div className="mb-3 p-3 bg-white rounded-full shadow-sm">
                                                <Clapperboard className="w-6 h-6 text-slate-300" />
                                            </div>
                                            <p className="text-xs font-medium text-slate-400 mb-4">Generate visual preview</p>
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => handleGeneratePreview(scene, idx)}
                                                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 hover:shadow-sm transition-all active:scale-95"
                                                >
                                                    <Image className="w-3.5 h-3.5" /> Image
                                                </button>
                                                {(structuredPrompts?.video_prompt || scene.video_prompt) && (
                                                    <button 
                                                        onClick={() => handleGenerateVideo(scene, idx)}
                                                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-95"
                                                    >
                                                        <VideoIcon className="w-3.5 h-3.5" /> Video
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {/* LOADING STATE */}
                                    {(loadingImageIdx === idx || loadingVideoIdx === idx) && (
                                        <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center">
                                            <Loader2 className="w-8 h-8 text-brand-500 animate-spin mb-2" />
                                            <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase animate-pulse">
                                                {loadingVideoIdx === idx ? 'Generating Video...' : 'Rendering Image...'}
                                            </span>
                                        </div>
                                    )}

                                    {/* VIDEO DISPLAY */}
                                    {previewVideos[cacheKey] && (
                                        <div className="relative w-full h-full group/video">
                                            <video src={previewVideos[cacheKey]} controls className="w-full h-full object-cover" />
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/video:opacity-100 transition-opacity">
                                                <button onClick={() => handleDownload(previewVideos[cacheKey] as string, `scene-${idx+1}-video.mp4`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                                <button onClick={() => setViewModalContent({type: 'video', url: previewVideos[cacheKey] as string})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                                            </div>
                                        </div>
                                    )}

                                    {/* IMAGE DISPLAY */}
                                    {!previewVideos[cacheKey] && previewImages[cacheKey] && (
                                        <div className="relative w-full h-full group/image">
                                            <img src={previewImages[cacheKey]} alt="Scene Preview" className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity"></div>
                                            <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/image:opacity-100 transition-opacity">
                                                <button onClick={() => handleDownload(previewImages[cacheKey] as string, `scene-${idx+1}-image.jpg`)} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Download className="w-3 h-3" /></button>
                                                <button onClick={() => setViewModalContent({type: 'image', url: previewImages[cacheKey] as string})} className="p-1.5 bg-black/60 hover:bg-black/80 text-white rounded backdrop-blur"><Maximize2 className="w-3 h-3" /></button>
                                            </div>
                                            {/* Regenerate Overlay on Hover */}
                                            <div className="absolute bottom-2 right-2 opacity-0 group-hover/image:opacity-100 transition-opacity flex gap-1">
                                                <button onClick={() => handleGeneratePreview(scene, idx)} className="px-2 py-1 bg-white/90 hover:bg-white text-slate-800 text-[10px] font-bold rounded shadow-sm backdrop-blur flex items-center gap-1">
                                                    <RefreshCw className="w-3 h-3" /> Regen
                                                </button>
                                                {(structuredPrompts?.video_prompt || scene.video_prompt) && (
                                                    <button onClick={() => handleGenerateVideo(scene, idx)} className="px-2 py-1 bg-indigo-600/90 hover:bg-indigo-600 text-white text-[10px] font-bold rounded shadow-sm backdrop-blur flex items-center gap-1">
                                                        <VideoIcon className="w-3 h-3" /> Video
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Visual Description */}
                                <div>
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
                                            <Clapperboard className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">Visual Direction</span>
                                    </div>
                                    <p className="text-sm text-slate-600 leading-relaxed font-medium">
                                        {scene.visual_description}
                                    </p>
                                </div>

                                {/* Technical Prompts (Compact) */}
                                {structuredPrompts && (
                                    <div className="space-y-2">
                                        <details className="group/details">
                                            <summary className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-brand-600 transition-colors select-none">
                                                <ChevronRight className="w-3 h-3 group-open/details:rotate-90 transition-transform" />
                                                Technical Prompts
                                            </summary>
                                            <div className="mt-3 space-y-3 pl-2 border-l border-slate-100">
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-slate-500">Image Prompt</span>
                                                        <button onClick={() => copyToClipboard(`img-p-${idx}`, structuredPrompts.image_prompt)} className="text-slate-300 hover:text-brand-500"><Copy className="w-3 h-3"/></button>
                                                    </div>
                                                    <code className="block text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 font-mono leading-relaxed">{structuredPrompts.image_prompt}</code>
                                                </div>
                                                <div>
                                                    <div className="flex justify-between items-center mb-1">
                                                        <span className="text-[10px] font-bold text-indigo-500">Video Prompt</span>
                                                        <button onClick={() => copyToClipboard(`vid-p-${idx}`, structuredPrompts.video_prompt)} className="text-slate-300 hover:text-indigo-500"><Copy className="w-3 h-3"/></button>
                                                    </div>
                                                    <code className="block text-[10px] text-indigo-600/80 bg-indigo-50/30 p-2 rounded border border-indigo-50 font-mono leading-relaxed">{structuredPrompts.video_prompt}</code>
                                                </div>
                                            </div>
                                        </details>
                                    </div>
                                )}
                            </div>

                            {/* RIGHT COLUMN: SCRIPT & AUDIO */}
                            <div className="w-full md:w-7/12 flex flex-col">
                                {/* Header Desktop */}
                                <div className="hidden md:flex items-center justify-between mb-6 border-b border-slate-100 pb-4">
                                    <div className="flex items-center gap-3">
                                        <span className="text-sm font-black text-slate-300 uppercase tracking-widest">Scene {idx + 1}</span>
                                        <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full">{scene.seconds}s</span>
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => copyToClipboard(`scene-${idx}`, scene)} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Copy JSON">
                                            {copiedSection === `scene-${idx}` ? <Check className="w-4 h-4"/> : <FileJson className="w-4 h-4"/>}
                                        </button>
                                    </div>
                                </div>

                                {/* Script Body */}
                                <div className="flex-1 space-y-6">
                                    
                                    {/* Spoken Audio */}
                                    <div className="space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="p-1.5 bg-rose-50 text-rose-500 rounded-md">
                                                    <Mic className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Voiceover</span>
                                            </div>
                                            <button onClick={() => copyToClipboard(`script-${idx}`, scene.audio_script)} className="text-xs text-slate-400 hover:text-brand-600 transition-colors">
                                                {copiedSection === `script-${idx}` ? "Copied" : "Copy"}
                                            </button>
                                        </div>
                                        <div className="pl-4 border-l-2 border-rose-100">
                                            <p className="font-serif text-xl md:text-2xl text-slate-800 leading-relaxed">
                                                "{scene.audio_script}"
                                            </p>
                                        </div>
                                    </div>

                                    {/* Overlay */}
                                    {scene.on_screen_text && (
                                        <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4">
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1 bg-amber-100 text-amber-600 rounded">
                                                    <Monitor className="w-3 h-3" />
                                                </div>
                                                <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider">Text Overlay</span>
                                            </div>
                                            <p className="text-amber-900 font-bold text-lg tracking-tight">{scene.on_screen_text}</p>
                                        </div>
                                    )}
                                </div>

                                {/* Audio Controls Footer */}
                                <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3">
                                    <button 
                                        onClick={() => handleTogglePlay(scene.audio_script as string, idx)} 
                                        disabled={loadingIdx === idx}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                                            playingIdx === idx 
                                            ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200' 
                                            : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20'
                                        }`}
                                    >
                                        {loadingIdx === idx ? (
                                            <>
                                            <Loader2 className="w-4 h-4 animate-spin"/> Generating Audio...
                                            </>
                                        ) : playingIdx === idx ? (
                                            <>
                                            <Pause className="w-4 h-4 fill-current"/> Pause Voiceover
                                            </>
                                        ) : (
                                            <>
                                            {ttsProvider === 'elevenlabs' ? <Volume2 className="w-4 h-4"/> : <Play className="w-4 h-4 fill-current"/>} 
                                            {audioUrls[cacheKey] ? 'Play Voiceover' : `Generate Audio (${ttsProvider === 'elevenlabs' ? '11Labs' : ttsProvider === 'aws' ? 'AWS' : 'Gemini'})`}
                                            </>
                                        )}
                                    </button>

                                    {audioUrls[cacheKey] && (
                                        <button 
                                            onClick={() => handleDownload(audioUrls[cacheKey] as string, `scene-${idx+1}-audio.mp3`)}
                                            className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border border-slate-200 active:scale-95 shadow-sm"
                                        >
                                            <Download className="w-5 h-5" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                );
            })}
        </div>
      )}
    </div>
  );
};
