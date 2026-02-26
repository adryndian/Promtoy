import { uploadBase64Asset } from '../services/cloudflareService';

import React, { useState, useRef, useEffect } from 'react';
import { GeneratedAsset, Scene } from '../types';
import { useAppContext } from '../store/AppContext';
import { SceneCard } from './SceneCard';
// Tambahkan Loader2 di baris import lucide-react ini:


import { generateSpeech, getWavBlob, analyzeVoiceStyle, generateImagePreview, generateVideo } from '../services/geminiService';
import { generateImageHuggingFace, generateVideoHuggingFace, generateImageCloudflare, generateImageXai } from '../services/externalService';
import { generateImageTogether, generateImageDashscope, generateVideoDashscope } from '../services/multiProviderService';
import { generateImageBedrock, generateSpeechBedrock } from '../services/awsService';
import { fetchElevenLabsVoices, generateElevenLabsSpeech, ElevenLabsVoice, ELEVENLABS_MODELS, ElevenLabsSettings } from '../services/elevenLabsService';
import JSZip from 'jszip';
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Image, Settings2, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, Film, Wand2, Video as VideoIcon, Volume2, SlidersHorizontal, Info, FileText, FileJson, Printer, Headphones, Palette, Aperture, Layers, Split, Smile, ChevronDown, ChevronUp, Lightbulb, Target, Shield, Users, Brain, Megaphone, RefreshCw, ChevronRight, Archive } from 'lucide-react';
import { SettingsModal } from './SettingsModal';

const GEMINI_VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];
const POLLY_VOICES = ['Joanna', 'Matthew', 'Ivy', 'Justin', 'Joey', 'Salli', 'Kimberly', 'Kendra', 'Raveena', 'Aditi', 'Emma', 'Brian', 'Amy', 'Arthur'];
const NOVA_VOICES = ['nova-en-US-Female-1', 'nova-en-US-Male-1', 'nova-en-GB-Female-1', 'nova-en-GB-Male-1'];

type AspectRatio = "9:16" | "16:9" | "1:1";
type TTSProvider = 'gemini' | 'elevenlabs' | 'aws';

interface OutputDisplayProps {
    onUpdate?: (updatedData: GeneratedAsset) => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({ onUpdate }) => {
  // Ambil state dari Context (Menggantikan props `data` dan `modelUsed` yang dihapus)
  const { result: data, setResult, formDataState } = useAppContext();

  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [loadingIdx, setLoadingIdx] = useState<number | null>(null);
  
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [previewImages, setPreviewImages] = useState<Record<string, string>>({});
  const [previewVideos, setPreviewVideos] = useState<Record<string, string>>({});
  
  const [activeAudio, setActiveAudio] = useState<HTMLAudioElement | null>(null);
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  
  const [activeVariationIndex, setActiveVariationIndex] = useState(0);
  const [showStrategy, setShowStrategy] = useState(false);

  const [ttsProvider, setTtsProvider] = useState<TTSProvider>('gemini');
  const [activeVoice, setActiveVoice] = useState<string>('Kore');
  const [speechStyle, setSpeechStyle] = useState<string>('Natural');
  
  const [awsSpeed, setAwsSpeed] = useState<string>("1.0");
  const [audioHistory, setAudioHistory] = useState<Record<string, { url: string, model: string, timestamp: number }[]>>({});

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
  
  const [loadingImageIdx, setLoadingImageIdx] = useState<number | null>(null);
  const [loadingVideoIdx, setLoadingVideoIdx] = useState<number | null>(null);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [videoFps, setVideoFps] = useState<number>(24);
  const [videoMotion, setVideoMotion] = useState<number>(5);
  
  const [activeImageModel, setActiveImageModel] = useState<string>('gemini-2.5-flash-image');
  const [activeVideoModel, setActiveVideoModel] = useState<string>('veo-3.1-fast-generate-preview');

  const [viewModalContent, setViewModalContent] = useState<{type: 'image' | 'video', url: string} | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const [isProcessingVoice, setIsProcessingVoice] = useState(false);
  const [customVoiceTone, setCustomVoiceTone] = useState<string | null>(null);

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

    // Ambil default dari Context jika ada
    if (formDataState?.constraints?.image_generator_model) {
        setActiveImageModel(formDataState.constraints.image_generator_model);
    }

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
  }, [data, formDataState]);

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

  const handleElSettingChange = (field: keyof ElevenLabsSettings, value: any) => {
      setElSettings(prev => ({...prev, [field]: value}));
  };

  const handleTogglePlay = async (text: string, idx: number, forceRegenerate: boolean = false) => {
    if (playingIdx === idx && activeAudio && !forceRegenerate) {
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
      
      if (!url || forceRegenerate) {
        if (ttsProvider === 'gemini') {
             const tone = customVoiceTone || (speechStyle !== 'Natural' ? `Speak in a ${speechStyle} tone` : undefined);
             const b64 = await generateSpeech(text, activeVoice, tone);
             const blob = getWavBlob(b64);
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        } else if (ttsProvider === 'aws') {
             const b64 = await generateSpeechBedrock(text, activeVoice, { speed: awsSpeed });
             url = b64; 
        } else {
             const blobUrl = await generateElevenLabsSpeech(text, activeVoice, elSettings);
             const blob = await fetch(blobUrl).then(r => r.blob());
             const reader = new FileReader();
             reader.readAsDataURL(blob);
             await new Promise(resolve => reader.onloadend = resolve);
             url = reader.result as string;
        }
        
                // 🔥 CEGAT DI SINI: Upload Audio ke R2
        const r2Url = await uploadBase64Asset(url, 'audio/mp3', `voice-${activeVoice}-${Date.now()}.mp3`);
        const finalUrl = r2Url || url;

        setAudioUrls(prev => ({ ...prev, [cacheKey]: finalUrl }));
        
        setAudioHistory(prev => {
            const currentHistory = prev[cacheKey] || [];
            const newEntry = { url: finalUrl, model: `${ttsProvider}-${activeVoice}`, timestamp: Date.now() };
            return { ...prev, [cacheKey]: [newEntry, ...currentHistory].slice(0, 5) };
        });

                if (data && onUpdate) {
            const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
            if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                 updatedData.variations[activeVariationIndex].scenes[idx].generated_audio = finalUrl;
            } else if (updatedData.scenes) {
                 updatedData.scenes[idx].generated_audio = finalUrl;
            }
            onUpdate(updatedData);
        }
        
        // 🔥 TAMBAHKAN 1 BARIS INI SEBELUM KURUNG KURAWAL TUTUP:
        url = finalUrl;

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
      
      const promptToUse = scene.media_prompt_details?.image_prompt || scene.image_prompt || scene.visual_description;

      try {
          let imageUrl = "";
          
                    if (activeImageModel.startsWith('cf-flux-1-schnell')) {
               let modelId = "@cf/black-forest-labs/flux-1-schnell"; // Default
               
               if (activeImageModel === 'cf-flux-2-dev') {
                   modelId = "@cf/black-forest-labs/flux-2-dev";
               } else if (activeImageModel === 'cf-flux-2-klein') {
                   modelId = "@cf/black-forest-labs/flux-2-klein-9b";
               }

// Sekarang kita oper activeAspectRatio dari UI ke backend
               imageUrl = await generateImageCloudflare(promptToUse, modelId);

          } 

  
  else if (activeImageModel === 'grok-2-image') {

               imageUrl = await generateImageXai(promptToUse);
          } else if (activeImageModel.startsWith('aws-') || activeImageModel.startsWith('amazon.')) {
               let modelId = activeImageModel;
               if (activeImageModel === 'aws-titan') modelId = "amazon.titan-image-generator-v2:0";
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
              // 🔥 CEGAT DI SINI: Upload gambar ke R2 sebelum disimpan ke State/D1
              const ext = activeImageModel.includes('flux') ? 'png' : 'jpg';
              const r2Url = await uploadBase64Asset(imageUrl, `image/${ext}`, `scene-${idx}-${Date.now()}.${ext}`);
              const finalUrl = r2Url || imageUrl; // Jika R2 gagal, tetap gunakan base64 sebagai fallback

              setPreviewImages(prev => ({ ...prev, [cacheKey]: finalUrl }));
              if (data && onUpdate) {
                const updatedData = JSON.parse(JSON.stringify(data)) as GeneratedAsset;
                if (updatedData.variations && updatedData.variations[activeVariationIndex]) {
                     updatedData.variations[activeVariationIndex].scenes[idx].generated_image = finalUrl;
                } else if (updatedData.scenes) {
                     updatedData.scenes[idx].generated_image = finalUrl;
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
     
     const promptToUse = scene.media_prompt_details?.video_prompt || scene.video_prompt || scene.visual_description;

     try {
         let videoUrl = "";
         if (activeVideoModel === 'hf-cogvideo') {
             videoUrl = await generateVideoHuggingFace(promptToUse); 
         } else if (activeVideoModel === 'dashscope-wanx-video') {
             videoUrl = await generateVideoDashscope(promptToUse);
         } else {
             videoUrl = await generateVideo(promptToUse, activeVideoModel, videoFps, videoMotion);
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
  
    const [isExportingZip, setIsExportingZip] = useState(false);

  const handleExportZIP = async () => {
    if (!data) return;
    setIsExportingZip(true);
    
    try {
        const zip = new JSZip();
        const scenes = getActiveScenes();

        // 1. Masukkan Naskah Teks
        let txt = `TITLE: ${data.concept_title}\nHOOK: ${data.hook_rationale}\nANGLE: ${data.analysis_report?.winning_angle_logic}\n\n`;
        scenes.forEach((scene, i) => {
            txt += `SCENE ${i + 1} (${scene.seconds}s)\n`;
            txt += `VISUAL: ${scene.visual_description}\n`;
            txt += `AUDIO: ${scene.audio_script}\n`;
            txt += `OVERLAY: ${scene.on_screen_text}\n\n`;
        });
        zip.file("1_Master_Script.txt", txt);

        // 2. Fungsi pembantu untuk mengunduh media menjadi Blob
        const fetchAsBlob = async (url: string) => {
            const res = await fetch(url);
            return await res.blob();
        };

        // 3. Masukkan Semua Media per Scene
        const mediaPromises = scenes.map(async (scene, i) => {
            const cacheKey = `${activeVariationIndex}-${i}`;
            const folderName = `Scene_${i + 1}`;
            const folder = zip.folder(folderName);
            
            if (!folder) return;

            // Ambil Video atau Gambar
            if (previewVideos[cacheKey]) {
                const blob = await fetchAsBlob(previewVideos[cacheKey]);
                folder.file(`Video_${i + 1}.mp4`, blob);
            } else if (previewImages[cacheKey]) {
                const blob = await fetchAsBlob(previewImages[cacheKey]);
                const ext = previewImages[cacheKey].includes('png') ? 'png' : 'jpg';
                folder.file(`Image_${i + 1}.${ext}`, blob);
            }

            // Ambil Voiceover
            if (audioUrls[cacheKey]) {
                const blob = await fetchAsBlob(audioUrls[cacheKey]);
                folder.file(`Voiceover_${i + 1}.mp3`, blob);
            }
        });

        await Promise.all(mediaPromises);

        // 4. Generate dan Download ZIP
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${data.concept_title.replace(/\s+/g, '_')}_Assets.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

    } catch (error) {
        console.error("ZIP Export failed", error);
        alert("Gagal membuat file ZIP. Pastikan semua gambar dan audio sudah di-generate.");
    } finally {
        setIsExportingZip(false);
    }
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
      <div className="glass-panel p-5 md:p-8 rounded-3xl border-l-4 border-brand-500 bg-white relative overflow-hidden shadow-sm dark:bg-slate-900 dark:border-brand-600 dark:shadow-none">
        <button 
          onClick={() => setShowSettings(true)}
          className="absolute top-4 right-4 md:top-6 md:right-6 p-2 rounded-lg bg-slate-50 text-slate-400 border border-slate-100 hover:bg-slate-100 transition-colors dark:bg-slate-800 dark:border-slate-700 dark:text-slate-500 dark:hover:bg-slate-700"
          title="Configure AI Keys"
        >
          <Settings2 className="w-5 h-5" />
        </button>

        <div className="relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pr-12">
            <div>
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 mb-2 dark:text-white">{data.concept_title}</h2>
               <p className="text-slate-500 italic mb-4 text-sm md:text-base dark:text-slate-400">"{data.hook_rationale}"</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200 self-start md:self-auto dark:bg-slate-800 dark:border-slate-700">
                <button onClick={handleExportTXT} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-brand-400"><FileText className="w-3.5 h-3.5" /> TXT</button>
                <div className="w-px h-4 bg-slate-200 hidden sm:block dark:bg-slate-600"></div>
                <button onClick={handleExportJSON} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-brand-400"><FileJson className="w-3.5 h-3.5" /> JSON</button>
                <div className="w-px h-4 bg-slate-200 hidden sm:block dark:bg-slate-600"></div>
                                <button onClick={handlePrint} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-brand-600 hover:shadow-sm transition-all dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-brand-400"><Printer className="w-3.5 h-3.5" /> PDF</button>
                
                {/* TOMBOL ZIP BARU */}
                <div className="w-px h-4 bg-slate-200 hidden sm:block dark:bg-slate-600"></div>
                <button 
                    onClick={handleExportZIP} 
                    disabled={isExportingZip}
                    className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-black bg-brand-50 text-brand-600 border border-brand-200 hover:bg-brand-500 hover:text-white hover:shadow-md transition-all disabled:opacity-50 dark:bg-brand-900/30 dark:text-brand-400 dark:border-brand-900/50 dark:hover:bg-brand-600 dark:hover:text-white"
                >
                    {isExportingZip ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Archive className="w-3.5 h-3.5" />} 
                    {isExportingZip ? 'PACKING...' : 'ZIP ALL ASSETS'}
                </button>

            </div>
          </div>

          {/* 🔥 PASTE KODE YANG HILANG DI SINI (MULAI DARI SINI) 🔥 */}
          <div className="mt-4 space-y-3">
            {/* Row 1: Voice Control */}
            <div className="-mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 min-w-max pb-1">
                    <div className="flex items-center gap-3 text-xs text-brand-700 bg-brand-50 px-4 py-2 rounded-full border border-brand-200 whitespace-nowrap dark:bg-brand-900/20 dark:text-brand-300 dark:border-brand-900/30">
                    <Mic className="w-3.5 h-3.5" />
                    <div className="flex items-center gap-1 bg-white rounded p-0.5 border border-slate-200 shadow-sm dark:bg-slate-900 dark:border-slate-700">
                        <button onClick={() => handleProviderChange('gemini')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'gemini' ? 'bg-brand-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>Gemini</button>
                        <button onClick={() => handleProviderChange('aws')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'aws' ? 'bg-indigo-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>AWS (Polly/Nova)</button>
                        <button onClick={() => handleProviderChange('elevenlabs')} className={`px-2 py-0.5 rounded transition-all font-medium ${ttsProvider === 'elevenlabs' ? 'bg-orange-500/80 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}>ElevenLabs</button>
                    </div>
                    <span className="text-brand-300 dark:text-brand-800">|</span>
                    <div className="flex items-center gap-2">
                        <span className="text-brand-800/70 uppercase font-bold tracking-wider dark:text-brand-300/70">Voice:</span>
                        <select value={activeVoice} onChange={(e) => handleVoiceChange(e.target.value)} className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors max-w-[100px] truncate dark:text-slate-200 dark:hover:text-brand-400">
                        {ttsProvider === 'gemini' ? GEMINI_VOICES.map(v => <option key={v} value={v} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200">{v}</option>) 
                        : ttsProvider === 'aws' ? [...POLLY_VOICES, ...NOVA_VOICES].map(v => <option key={v} value={v} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200">{v}</option>)
                        : elevenLabsVoices.length > 0 ? elevenLabsVoices.map(v => <option key={v.voice_id} value={v.voice_id} className="bg-white text-slate-800 dark:bg-slate-800 dark:text-slate-200">{v.name}</option>)
                        : <option className="bg-white text-slate-400 dark:bg-slate-800 dark:text-slate-500">Loading/No Key...</option>}
                        </select>
                    </div>

                    {ttsProvider === 'aws' && (
                        <>
                            <span className="text-brand-300 dark:text-brand-800">|</span>
                            <div className="flex items-center gap-2">
                                <span className="text-brand-800/70 uppercase font-bold tracking-wider dark:text-brand-300/70">Speed:</span>
                                <select 
                                    value={awsSpeed} 
                                    onChange={(e) => setAwsSpeed(e.target.value)} 
                                    className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-brand-600 transition-colors dark:text-slate-200 dark:hover:text-brand-400"
                                >
                                    <option value="0.8" className="dark:bg-slate-800">0.8x</option>
                                    <option value="1.0" className="dark:bg-slate-800">1.0x</option>
                                    <option value="1.2" className="dark:bg-slate-800">1.2x</option>
                                </select>
                            </div>
                        </>
                    )}
                    </div>
                </div>
            </div>

            {/* Row 2: Visual Controls */}
            <div className="-mx-5 px-5 md:mx-0 md:px-0 overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-3 min-w-max pb-1">
                    <div className="flex items-center gap-3 text-xs text-purple-700 bg-purple-50 px-4 py-2 rounded-full border border-purple-200 whitespace-nowrap dark:bg-purple-900/20 dark:text-purple-300 dark:border-purple-900/30">
                    <Aperture className="w-3.5 h-3.5" />
                    <div className="flex items-center gap-2">
                        <span className="text-purple-800/70 uppercase font-bold tracking-wider dark:text-purple-300/70">Image:</span>
                                                <select 
                            value={activeImageModel}
                            onChange={(e) => setActiveImageModel(e.target.value)}
                            className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate dark:text-slate-200 dark:hover:text-purple-400"
                        >
                            <optgroup label="Google">
                                <option value="gemini-3-pro-image-preview" className="dark:bg-slate-800">Gemini 3 Pro</option>
                                <option value="gemini-2.5-flash-image" className="dark:bg-slate-800">Gemini 2.5</option>
                            </optgroup>
       //dropdown image model 
    <optgroup label="External AI">
    <option value="cf-flux-2-dev" className="dark:bg-slate-800">CF Flux 2 (Dev)</option>
    <option value="cf-flux-2-klein" className="dark:bg-slate-800">CF Flux 2 (Klein 9B)</option>
    <option value="cf-flux-schnell" className="dark:bg-slate-800">CF Flux 1 (Schnell)</option>
    <option value="amazon.titan-image-generator-v2:0" className="dark:bg-slate-800">AWS Titan v2</option>
    <option value="together-flux" className="dark:bg-slate-800">Together FLUX</option>
    <option value="hf-flux-dev" className="dark:bg-slate-800">HF FLUX Dev</option>
</optgroup>

                        </select>

                    </div>
                    <span className="text-purple-300 dark:text-purple-800">|</span>
                    <div className="flex items-center gap-2">
                        <span className="text-purple-800/70 uppercase font-bold tracking-wider dark:text-purple-300/70">Video:</span>
                                                <select 
                            value={activeVideoModel}
                            onChange={(e) => setActiveVideoModel(e.target.value)}
                            className="bg-transparent text-slate-800 font-bold border-none focus:ring-0 cursor-pointer p-0 text-xs appearance-none hover:text-purple-600 transition-colors max-w-[120px] truncate dark:text-slate-200 dark:hover:text-purple-400"
                        >
                            <option value="veo-3.1-fast-generate-preview" className="dark:bg-slate-800">Veo Fast</option>
                            <option value="veo-3.1-generate-preview" className="dark:bg-slate-800">Veo Quality</option>
                            <option value="hf-cogvideo" className="dark:bg-slate-800">HF CogVideo</option>
                            <option value="dashscope-wanx-video" className="dark:bg-slate-800">Wanx Video</option>
                        </select>

                    </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-full border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                        <div className="flex items-center gap-1 pr-1">
                            {[{ val: "9:16", icon: Smartphone }, { val: "16:9", icon: Monitor }, { val: "1:1", icon: Tablet }].map(r => (
                                <button key={r.val} onClick={() => setAspectRatio(r.val as AspectRatio)} className={`p-1.5 rounded-full transition-all ${aspectRatio === r.val ? 'bg-white text-brand-600 shadow-sm border border-slate-200 dark:bg-slate-700 dark:text-brand-400 dark:border-slate-600' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`}><r.icon className="w-3.5 h-3.5" /></button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
          </div>
          {/* 🔥 SAMPAI DI SINI 🔥 */}

        </div>
      </div>
      
      {/* Strategy & Insights Section */}
      {data.analysis_report && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-2 dark:bg-slate-900 dark:border-slate-700">
            <button 
                onClick={() => setShowStrategy(!showStrategy)}
                className="w-full flex items-center justify-between p-4 md:p-5 bg-slate-50 hover:bg-slate-100 transition-colors text-left dark:bg-slate-800 dark:hover:bg-slate-700"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg dark:bg-blue-900/20 dark:text-blue-400">
                        <Brain className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-800 text-sm md:text-base dark:text-slate-200">Creative Strategy & Insights</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Why this concept works</p>
                    </div>
                </div>
                {showStrategy ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            
            {showStrategy && (
                <div className="p-5 md:p-6 border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-8 dark:border-slate-700">
                    {/* Column 1: Analysis */}
                    <div className="space-y-6">
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Target className="w-3.5 h-3.5" /> Winning Angle
                            </div>
                            <p className="text-slate-800 font-medium leading-relaxed bg-blue-50/50 p-3 rounded-lg border border-blue-100 text-sm dark:bg-blue-900/20 dark:text-slate-200 dark:border-blue-900/30">
                                {data.analysis_report.winning_angle_logic}
                            </p>
                        </div>
                        
                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Users className="w-3.5 h-3.5" /> Target Audience
                            </div>
                            <p className="text-slate-700 text-sm leading-relaxed dark:text-slate-300">
                                {data.analysis_report.audience_persona}
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Shield className="w-3.5 h-3.5" /> Pain Points
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {data.analysis_report.core_pain_points.map((pt, i) => (
                                    <span key={i} className="px-2.5 py-1 bg-red-50 text-red-600 text-xs font-medium rounded-md border border-red-100 dark:bg-red-900/20 dark:text-red-400 dark:border-red-900/30">
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
                                    <span key={i} className="px-2.5 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-md border border-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-900/30">
                                        {trait}
                                    </span>
                                ))}
                            </div>
                            <p className="text-xs text-slate-500 italic dark:text-slate-400">
                                "Audience Guess: {data.brand_dna?.audience_guess}"
                            </p>
                        </div>

                        <div>
                            <div className="flex items-center gap-2 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                <Lightbulb className="w-3.5 h-3.5" /> Product Truths
                            </div>
                            <ul className="space-y-2">
                                {data.product_truth_sheet?.safe_benefit_phrases?.slice(0, 3).map((phrase, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
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
            <div className="bg-slate-100 p-1 rounded-xl inline-flex shadow-inner dark:bg-slate-800">
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
                            ? 'bg-white text-brand-600 shadow-sm ring-1 ring-black/5 dark:bg-slate-700 dark:text-brand-400' 
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
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
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl bg-white/50 dark:bg-slate-800/50 dark:border-slate-700">
                <Loader2 className="w-8 h-8 text-brand-500 animate-spin mx-auto mb-3" />
                <h3 className="text-slate-800 font-bold mb-1 dark:text-slate-200">Director is drafting scenes...</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Writing scripts based on brand DNA: <span className="text-brand-600 font-medium dark:text-brand-400">{data.brand_dna?.voice_traits?.join(', ')}</span></p>
            </div>
         </div>
      ) : (
        <div className="space-y-4">
            {scenes.map((scene: Scene, idx: number) => (
                <SceneCard 
                    key={idx}
                    scene={scene}
                    idx={idx}
                    activeVariationIndex={activeVariationIndex}
                    aspectRatio={aspectRatio}
                    ttsProvider={ttsProvider}
                    activeAudio={activeAudio}
                    playingIdx={playingIdx}
                    loadingIdx={loadingIdx}
                    loadingImageIdx={loadingImageIdx}
                    loadingVideoIdx={loadingVideoIdx}
                    previewImages={previewImages}
                    previewVideos={previewVideos}
                    audioUrls={audioUrls}
                    audioHistory={audioHistory}
                    copiedSection={copiedSection}
                    handleTogglePlay={handleTogglePlay}
                    handleGeneratePreview={handleGeneratePreview}
                    handleGenerateVideo={handleGenerateVideo}
                    handleDownload={handleDownload}
                    copyToClipboard={copyToClipboard}
                    setViewModalContent={setViewModalContent}
                />
            ))}
        </div>
      )}
    </div>
  );
};
