
import React, { useState, useEffect, useRef } from 'react';
import { FormData } from '../types';
import { Sparkles, Type, Tag, Smartphone, FileText, Loader2, Image as ImageIcon, Globe, Settings2, Cpu, Zap, Layers, CheckCircle2, Clock, Palette, Camera, Sun, Paintbrush, Split, Smile, Move, Gauge, Cloud, User, Shirt, Eye, Lock } from 'lucide-react';
import { analyzeImageForBrief } from '../services/geminiService';
import { analyzeImageForBriefHuggingFace, analyzeImageForBriefCloudflare, analyzeReferenceImage, analyzeImageForBriefGroq, getStoredHuggingFaceKey, getStoredCloudflareId, getStoredGroqKey, getStoredAwsAccessKey } from '../services/externalService';
import { analyzeImageBedrock, analyzeReferenceImageBedrock } from '../services/awsService';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  isLoading: boolean;
  initialValues?: FormData | null;
  activeProvider?: string;
  openRouterModel?: string;
  onOpenSettings?: () => void;
}

const defaultData: FormData = {
  brand: { name: '', tone_hint_optional: '', country_market_optional: 'ID' },
  product: { type: '', material: '', price_tier_optional: 'mid', platform: ['tiktok'], objective: 'conversion', main_angle_optional: 'problem-solution' },
  scrape: { source_url_optional: '', raw_text_optional: '' },
  constraints: { do_not_say_optional: [], must_include_optional: [], language: 'id', vo_duration_seconds: 30, scene_count: 5, ai_model: 'gemini-3-pro-preview', image_generator_model: 'gemini-3-pro-image-preview', variations_count: 1 },
  visual_settings: { camera_angle: 'Eye-level', lighting: 'Natural/Soft', art_style: 'Realistic/UGC', pacing: 'Medium', camera_movement_style: 'Handheld/Shaky' },
  references: { face_description: '', outfit_description: '' }
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, isLoading, initialValues, onOpenSettings }) => {
  const [data, setData] = useState<FormData>(defaultData);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [visionProvider, setVisionProvider] = useState<'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'aws'>('gemini');
  const [lockToast, setLockToast] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const faceInputRef = useRef<HTMLInputElement>(null);
  const outfitInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialValues) {
      const safeData = {
          ...initialValues,
          constraints: {
              ...initialValues.constraints,
              ai_model: initialValues.constraints.ai_model || 'gemini-3-pro-preview', 
              image_generator_model: initialValues.constraints.image_generator_model || 'gemini-3-pro-image-preview',
              variations_count: initialValues.constraints.variations_count || 1
          },
          visual_settings: { ...defaultData.visual_settings, ...(initialValues.visual_settings || {}) },
          references: { ...defaultData.references, ...(initialValues.references || {}) }
      };
      setData(safeData);
    }
  }, [initialValues]);

  const handleChange = (section: keyof FormData, field: string, value: any) => {
    setData((prev) => ({ ...prev, [section]: { ...prev[section], [field]: value } }));
  };

  const togglePlatform = (platform: any) => {
    setData((prev) => {
      const current = prev.product.platform;
      const updated = current.includes(platform) ? current.filter((p) => p !== platform) : [...current, platform];
      return { ...prev, product: { ...prev.product, platform: updated } };
    });
  };

  const handleSceneCountChange = (count: number) => {
      handleChange('constraints', 'scene_count', count);
  };

  const showLockToast = (msg: string) => {
      setLockToast(msg);
      setTimeout(() => setLockToast(null), 3000);
  };

  // Helper to check keys before action
  const checkProviderReady = (provider: string): boolean => {
      if (provider === 'huggingface' && !getStoredHuggingFaceKey()) return false;
      if (provider === 'cloudflare' && !getStoredCloudflareId()) return false;
      if (provider === 'groq' && !getStoredGroqKey()) return false;
      if (provider === 'aws' && !getStoredAwsAccessKey()) return false;
      return true;
  };

  const promptForKey = (provider: string) => {
      const shouldOpen = window.confirm(`${provider.toUpperCase()} API Key/Token is missing. Open Settings to configure?`);
      if (shouldOpen && onOpenSettings) onOpenSettings();
  };

  // Main Image Analysis (Auto-fill Brief)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!checkProviderReady(visionProvider)) {
        promptForKey(visionProvider);
        if (fileInputRef.current) fileInputRef.current.value = '';
        return;
    }

    setIsAnalyzingImage(true);
    try {
        const reader = new FileReader();
        reader.onloadend = async () => {
            const base64String = (reader.result as string).split(',')[1];
            const mimeType = file.type;
            
            try {
                let analysis;
                if (visionProvider === 'huggingface') {
                    console.log("Using Hugging Face Llama 3.2 Vision");
                    analysis = await analyzeImageForBriefHuggingFace(base64String);
                } else if (visionProvider === 'cloudflare') {
                    console.log("Using Cloudflare Workers AI Vision");
                    analysis = await analyzeImageForBriefCloudflare(base64String);
                } else if (visionProvider === 'groq') {
                    console.log("Using Groq Llama 3.2 Vision");
                    analysis = await analyzeImageForBriefGroq(base64String);
                } else if (visionProvider === 'aws') {
                    console.log("Using AWS Bedrock Claude 3 Sonnet");
                    analysis = await analyzeImageBedrock(base64String, mimeType);
                } else {
                    console.log("Using Gemini Pro Vision");
                    analysis = await analyzeImageForBrief(base64String, mimeType);
                }
                
                const newPriceTier = analysis.price_tier ? analysis.price_tier.toLowerCase() : prev => prev.product.price_tier_optional;
                const newAngle = analysis.marketing_angle ? analysis.marketing_angle.toLowerCase() : prev => prev.product.main_angle_optional;

                setData(prev => ({
                    ...prev,
                    brand: {
                        ...prev.brand,
                        name: analysis.brand_name || prev.brand.name,
                        tone_hint_optional: analysis.brand_tone || prev.brand.tone_hint_optional
                    },
                    product: {
                        ...prev.product,
                        type: analysis.product_type || prev.product.type,
                        material: analysis.product_material || prev.product.material,
                        price_tier_optional: ['budget', 'mid', 'premium'].includes(newPriceTier) ? newPriceTier : 'mid',
                        main_angle_optional: newAngle || 'problem-solution'
                    },
                    scrape: {
                        ...prev.scrape,
                        raw_text_optional: (prev.scrape.raw_text_optional ? prev.scrape.raw_text_optional + "\n\n" : "") + (analysis.raw_context ? `[${visionProvider.toUpperCase()} Vision Analysis]: ${analysis.raw_context}` : "")
                    }
                }));
                
                alert(`Form auto-filled using ${visionProvider.toUpperCase()} Vision!`);
            } catch (err) {
                console.error("Image Analysis Error:", err);
                const msg = err instanceof Error ? err.message : "Unknown error";
                
                if (msg.includes("Credentials missing") || msg.includes("API Key missing") || msg.includes("Key missing")) {
                    promptForKey(visionProvider);
                } else {
                    alert(`Analysis failed with ${visionProvider}. ${msg}`);
                }
            } finally {
                setIsAnalyzingImage(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            }
        };
        reader.readAsDataURL(file);
    } catch (err) {
        setIsAnalyzingImage(false);
        console.error("File reading failed", err);
    }
  };

  // Reference Image Upload (Face/Outfit Lock)
  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'outfit') => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determine provider: prefer CF/HF if set, fallback logic inside service, but check basic presence here
    const providerToUse = visionProvider === 'gemini' ? 'cloudflare' : visionProvider; 
    
    // If not Gemini, check keys immediately
    if (providerToUse !== 'gemini' && !checkProviderReady(providerToUse)) {
         // Fallback silently to Gemini if CF/HF missing for simple ref analysis, or prompt?
         // Let's prompt if they explicitly chose that provider, otherwise fallback to Gemini if in 'gemini' mode
         if (visionProvider !== 'gemini') {
             promptForKey(providerToUse);
             if (e.target) e.target.value = '';
             return;
         }
    }

    setIsAnalyzingRef(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        try {
            let description = "";
            
            if (providerToUse === 'aws') {
                description = await analyzeReferenceImageBedrock(base64String, type);
            } else {
                description = await analyzeReferenceImage(base64String, type, providerToUse as 'huggingface' | 'cloudflare' | 'groq');
            }
            
            if (!description && visionProvider === 'gemini') {
                 // Fallback if HF/CF failed or keys missing
                 const geminiAnalysis = await analyzeImageForBrief(base64String, file.type);
                 description = geminiAnalysis.raw_context;
            }

            if (description) {
                setData(prev => ({
                    ...prev,
                    references: {
                        ...prev.references,
                        [type === 'face' ? 'face_image_base64' : 'outfit_image_base64']: base64String,
                        [type === 'face' ? 'face_description' : 'outfit_description']: description
                    }
                }));
                showLockToast(`${type === 'face' ? 'Face' : 'Outfit'} locked!`);
            } else {
                throw new Error("Could not extract description.");
            }
        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("Missing") || e.message?.includes("Credentials") || e.message?.includes("Key missing")) {
                 promptForKey(providerToUse);
            } else {
                 alert(`Failed to analyze reference. Ensure you have API keys.`);
            }
        } finally {
            setIsAnalyzingRef(false);
            if (e.target) e.target.value = '';
        }
    };
    reader.readAsDataURL(file);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (data.product.platform.length === 0) return alert("Select platform"); onSubmit(data); }} className="space-y-5 text-sm">
      
      {/* Brand */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-brand-500 relative">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
             <h3 className="text-slate-800 font-bold flex items-center gap-2 text-base"><Type className="w-5 h-5 text-brand-500"/> Brand Identity</h3>
             
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                
                <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200">
                    <button type="button" onClick={() => setVisionProvider('gemini')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'gemini' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Gemini Vision"><Zap className="w-3 h-3"/> Gemini</button>
                    <button type="button" onClick={() => setVisionProvider('aws')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'aws' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="AWS Bedrock (Claude 3)"><Cloud className="w-3 h-3"/> AWS</button>
                    <button type="button" onClick={() => setVisionProvider('groq')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'groq' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Groq Llama 3.2"><Eye className="w-3 h-3"/> Groq</button>
                    <button type="button" onClick={() => setVisionProvider('huggingface')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'huggingface' ? 'bg-white text-yellow-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Hugging Face"><Smile className="w-3 h-3"/> HF</button>
                    <button type="button" onClick={() => setVisionProvider('cloudflare')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'cloudflare' ? 'bg-white text-orange-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`} title="Cloudflare Workers AI"><Cloud className="w-3 h-3"/> CF</button>
                </div>

                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzingImage || isLoading} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all font-semibold active:scale-95 whitespace-nowrap ${visionProvider === 'gemini' ? 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                    {isAnalyzingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3" />}
                    {isAnalyzingImage ? "Scanning..." : "Auto-fill"}
                </button>
                
                {/* Role Model (Moved Inside) */}
                <div className="flex items-center gap-2 p-1.5 rounded-full bg-white/50 backdrop-blur-sm border border-slate-200 shadow-sm transition-all hover:bg-white/80 ml-2 group/lock">
                     <span className="text-[10px] font-bold text-slate-400 pl-2 uppercase tracking-wider hidden sm:inline-block">Role Lock</span>
                     <input type="file" ref={faceInputRef} accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(e, 'face')} />
                     <input type="file" ref={outfitInputRef} accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(e, 'outfit')} />

                     {/* Face Lock */}
                     <button 
                        type="button"
                        onClick={() => data.references?.face_image_base64 ? setData(prev => ({...prev, references: {...prev.references, face_description: '', face_image_base64: ''}})) : faceInputRef.current?.click()}
                        disabled={isAnalyzingRef}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${data.references?.face_image_base64 ? 'ring-2 ring-pink-500' : 'bg-slate-100 hover:bg-pink-50 text-slate-400 hover:text-pink-500'}`}
                        title="Lock Face (Consistent Character)"
                     >
                        {data.references?.face_image_base64 ? (
                            <img src={`data:image/jpeg;base64,${data.references.face_image_base64}`} className="w-full h-full rounded-full object-cover" />
                        ) : isAnalyzingRef ? <Loader2 className="w-3 h-3 animate-spin"/> : <User className="w-3.5 h-3.5" />}
                     </button>

                     {/* Outfit Lock */}
                     <button 
                        type="button"
                        onClick={() => data.references?.outfit_image_base64 ? setData(prev => ({...prev, references: {...prev.references, outfit_description: '', outfit_image_base64: ''}})) : outfitInputRef.current?.click()}
                        disabled={isAnalyzingRef}
                        className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${data.references?.outfit_image_base64 ? 'ring-2 ring-indigo-500' : 'bg-slate-100 hover:bg-indigo-50 text-slate-400 hover:text-indigo-500'}`}
                        title="Lock Outfit (Consistent Style)"
                     >
                        {data.references?.outfit_image_base64 ? (
                            <img src={`data:image/jpeg;base64,${data.references.outfit_image_base64}`} className="w-full h-full rounded-full object-cover" />
                        ) : isAnalyzingRef ? <Loader2 className="w-3 h-3 animate-spin"/> : <Shirt className="w-3.5 h-3.5" />}
                     </button>

                    {/* Mini Toast */}
                    {lockToast && (
                        <div className="absolute top-[-30px] right-0 bg-slate-800 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow-lg animate-in fade-in slide-in-from-bottom-1 whitespace-nowrap z-50">
                            {lockToast}
                        </div>
                    )}
                    
                    {/* Tooltip on Hover */}
                    <div className="absolute top-10 right-0 w-48 bg-slate-800 text-white text-[10px] p-2 rounded-lg shadow-xl opacity-0 group-hover/lock:opacity-100 transition-opacity pointer-events-none z-50">
                        <p className="font-bold mb-0.5">Role Model Lock</p>
                        <p className="opacity-80 leading-tight">Upload a face or outfit to keep characters consistent across generated scenes.</p>
                    </div>
                  </div>
             </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1">Brand Name</label>
             <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.brand.name} onChange={(e) => handleChange('brand', 'name', e.target.value)} placeholder="e.g. GlowUp Co." />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1">Brand Tone</label>
             <input type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.brand.tone_hint_optional} onChange={(e) => handleChange('brand', 'tone_hint_optional', e.target.value)} placeholder="e.g. Fun, Scientific, Bold" />
          </div>
        </div>
      </div>

      {/* Role Model (Removed from here) */}
      
      {/* Product */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-purple-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><Tag className="w-5 h-5 text-purple-500"/> Product Specs</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.product.type} onChange={(e) => handleChange('product', 'type', e.target.value)} placeholder="Type (e.g. Serum) *" />
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base" value={data.product.material} onChange={(e) => handleChange('product', 'material', e.target.value)} placeholder="Key Feature (e.g. Retinol) *" />
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white" value={data.product.objective} onChange={(e) => handleChange('product', 'objective', e.target.value)}>
             <option className="bg-white" value="conversion">Goal: Conversion</option>
             <option className="bg-white" value="awareness">Goal: Awareness</option>
          </select>
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white" value={data.product.main_angle_optional} onChange={(e) => handleChange('product', 'main_angle_optional', e.target.value)}>
             <option className="bg-white" value="problem-solution">Angle: Problem-Solution</option>
             <option className="bg-white" value="routine">Angle: Routine</option>
             <option className="bg-white" value="review">Angle: Review</option>
             <option className="bg-white" value="aesthetic">Angle: Aesthetic</option>
             <option className="bg-white" value="comparison">Angle: Comparison</option>
          </select>
        </div>
        <div className="flex gap-2">
          {['tiktok', 'reels', 'shorts'].map(p => (
            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all font-medium text-sm active:scale-95 ${data.product.platform.includes(p as any) ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm' : 'glass-input border-transparent text-slate-500 hover:bg-slate-50'}`}>
              <Smartphone className="w-4 h-4"/> <span className="capitalize">{p}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Visual Director Settings */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-amber-500">
         <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><Camera className="w-5 h-5 text-amber-500"/> Visual Director</h3>
         
         <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1"><Sun className="w-3 h-3"/> Lighting</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white" 
                  value={data.visual_settings.lighting} 
                  onChange={(e) => handleChange('visual_settings', 'lighting', e.target.value)}
               >
                  <option value="Natural/Soft">Natural / Soft</option>
                  <option value="Golden Hour">Golden Hour</option>
                  <option value="Studio/High-key">Studio (Bright)</option>
                  <option value="Moody/Cinematic">Moody / Cinematic</option>
                  <option value="Neon/Cyberpunk">Neon / Cyberpunk</option>
                  <option value="Ring light">Ring Light (Influencer)</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1"><Camera className="w-3 h-3"/> Camera Angle</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white" 
                  value={data.visual_settings.camera_angle} 
                  onChange={(e) => handleChange('visual_settings', 'camera_angle', e.target.value)}
               >
                  <option value="Eye-level">Eye-Level (Standard)</option>
                  <option value="POV">POV (First Person)</option>
                  <option value="Low angle">Low Angle (Hero)</option>
                  <option value="High angle">High Angle</option>
                  <option value="Macro">Macro (Close-up)</option>
                  <option value="Drone/Aerial">Drone / Aerial</option>
                  <option value="Dutch angle">Dutch Angle (Dynamic)</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1"><Paintbrush className="w-3 h-3"/> Art Style</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white" 
                  value={data.visual_settings.art_style} 
                  onChange={(e) => handleChange('visual_settings', 'art_style', e.target.value)}
               >
                  <option value="Realistic/UGC">Realistic / UGC</option>
                  <option value="Cinematic">Cinematic TVC</option>
                  <option value="Vintage/Retro">Vintage / Retro</option>
                  <option value="Minimalist">Minimalist</option>
                  <option value="Vibrant/Pop">Vibrant / Pop Art</option>
                  <option value="Editorial">Editorial / Fashion</option>
               </select>
            </div>
         </div>

         {/* New Specific Details Row */}
         <div className="grid md:grid-cols-2 gap-4">
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1"><Gauge className="w-3 h-3"/> Video Pacing</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white" 
                  value={data.visual_settings.pacing || 'Medium'} 
                  onChange={(e) => handleChange('visual_settings', 'pacing', e.target.value)}
               >
                  <option value="Slow-paced">Slow & Relaxed</option>
                  <option value="Medium">Medium (Natural)</option>
                  <option value="Fast-paced">Fast-paced (TikTok)</option>
                  <option value="Hyper-fast">Hyper-fast (ASMR/Trends)</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1"><Move className="w-3 h-3"/> Movement Style</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white" 
                  value={data.visual_settings.camera_movement_style || 'Handheld/Shaky'} 
                  onChange={(e) => handleChange('visual_settings', 'camera_movement_style', e.target.value)}
               >
                  <option value="Handheld/Shaky">Handheld / UGC Style</option>
                  <option value="Static/Tripod">Static / Tripod</option>
                  <option value="Smooth/Gimbal">Smooth / Gimbal</option>
                  <option value="Dynamic/Whip-pans">Dynamic / Transitions</option>
               </select>
            </div>
         </div>
      </div>

      {/* Format Settings (Scenes & Duration) */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-blue-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><Settings2 className="w-5 h-5 text-blue-500"/> Format Control</h3>
        
        <div className="space-y-6">
            
            {/* Model & Image Model Config */}
            <div className="grid md:grid-cols-2 gap-6">
                
                {/* Text Model - Limited to Gemini for Logic */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Cpu className="w-4 h-4 text-blue-400"/> AI Script Brain (VO Text)</span>
                    </div>
                    <select 
                        value={data.constraints.ai_model}
                        onChange={(e) => handleChange('constraints', 'ai_model', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none"
                    >
                        <optgroup label="Groq (Latest)">
                            <option value="deepseek-r1-distill-llama-70b">DeepSeek R1 Distill (Hot)</option>
                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Latest)</option>
                            <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fastest)</option>
                        </optgroup>
                        <optgroup label="Gemini">
                            <option value="gemini-3-pro-preview">Gemini 3 Pro (Smartest)</option>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Fast)</option>
                        </optgroup>
                        <optgroup label="AWS Bedrock">
                            <option value="meta.llama3-1-70b-instruct-v1:0">Llama 3.1 70B (AWS)</option>
                            <option value="us.anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet (AWS)</option>
                        </optgroup>
                        <optgroup label="Other (Groq)">
                            <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                            <option value="qwen-2.5-32b">Qwen 2.5 32B</option>
                        </optgroup>
                    </select>
                </div>

                {/* Image/Video Generator Model - Integrated External Services */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                         <span className="text-slate-500 flex items-center gap-2 font-medium"><Palette className="w-4 h-4 text-purple-400"/> Media Generator</span>
                    </div>
                    <select 
                        value={data.constraints.image_generator_model}
                        onChange={(e) => handleChange('constraints', 'image_generator_model', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-purple-500 focus:bg-white transition-all outline-none"
                    >
                        <optgroup label="Google (Default)">
                            <option value="gemini-3-pro-image-preview">Gemini 3 Image (Best Quality)</option>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Image (Fast)</option>
                            <option value="imagen-3.0-generate-001">Imagen 3 (Photorealistic)</option>
                        </optgroup>
                        <optgroup label="AWS Bedrock">
                            <option value="amazon.titan-image-generator-v2:0">Titan Image Gen v2</option>
                            <option value="amazon.nova-canvas-v1:0">Amazon Nova Canvas</option>
                            <option value="stability.sd3-large-v1:0">SD3 Large</option>
                        </optgroup>
                        <optgroup label="Cloudflare (New)">
                             <option value="cf-flux-schnell">Flux 1 Schnell (Cloudflare)</option>
                        </optgroup>
                        <optgroup label="Hugging Face (Requires Token)">
                            <option value="hf-flux-dev">FLUX.1-dev (HuggingFace)</option>
                            <option value="hf-sdxl">SDXL Base 1.0 (HuggingFace)</option>
                        </optgroup>
                    </select>
                </div>
            </div>

            {/* Sliders Grid */}
            <div className="grid md:grid-cols-2 gap-6">
                {/* Scene Count Slider */}
                <div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Layers className="w-4 h-4 text-blue-400"/> Scene Count</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">{data.constraints.scene_count || 5} Scenes</span>
                    </div>
                    <input 
                        type="range" 
                        min="3" 
                        max="10" 
                        step="1" 
                        value={data.constraints.scene_count || 5} 
                        onChange={(e) => handleSceneCountChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>

                {/* Duration Slider */}
                <div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-slate-500 flex items-center gap-2 font-medium"><Clock className="w-4 h-4 text-blue-400"/> Duration</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200">{data.constraints.vo_duration_seconds}s</span>
                    </div>
                    <input 
                        type="range" 
                        min="15" 
                        max="90" 
                        step="5" 
                        value={data.constraints.vo_duration_seconds} 
                        onChange={(e) => handleChange('constraints', 'vo_duration_seconds', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                    />
                </div>
            </div>

            {/* A/B Testing Variations */}
            <div>
                 <div className="flex justify-between text-sm mb-3">
                    <span className="text-slate-500 flex items-center gap-2 font-medium"><Split className="w-4 h-4 text-emerald-500"/> Creative Variations (A/B Test)</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200">{data.constraints.variations_count} Variations</span>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(count => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => handleChange('constraints', 'variations_count', count)}
                            className={`flex-1 py-3 rounded-lg border text-sm font-bold transition-all ${data.constraints.variations_count === count ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white'}`}
                        >
                            {count} {count === 1 ? 'Script' : 'Scripts'}
                        </button>
                    ))}
                </div>
            </div>

        </div>
      </div>

      {/* Context */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl border-l-4 border-emerald-500">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base"><FileText className="w-5 h-5 text-emerald-500"/> Context (Optional)</h3>
        <textarea className="glass-input w-full p-3.5 rounded-xl h-24 placeholder-slate-400 text-base" value={data.scrape.raw_text_optional} onChange={(e) => handleChange('scrape', 'raw_text_optional', e.target.value)} placeholder="Paste product details, facts, or competitor copy here..." />
      </div>

      <button disabled={isLoading} className="w-full bg-brand-600 hover:bg-brand-500 text-white font-black text-lg py-4 rounded-xl shadow-lg shadow-brand-500/30 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
        {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6 fill-white" />}
        {isLoading ? "DIRECTOR IS THINKING..." : "GENERATE CAMPAIGN"}
      </button>
    </form>
  );
};
