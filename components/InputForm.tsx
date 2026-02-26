import React, { useState, useEffect, useRef } from 'react';
import { FormData } from '../types';
import { useAppContext } from '../store/AppContext';
import { Sparkles, Type, Tag, Smartphone, FileText, Loader2, Image as ImageIcon, Globe, Settings2, Cpu, Zap, Layers, CheckCircle2, Clock, Palette, Camera, Sun, Paintbrush, Split, Smile, Move, Gauge, Cloud, User, Shirt, Eye, Lock, Square } from 'lucide-react';
import { analyzeImageForBrief } from '../services/geminiService';
import { analyzeImageForBriefHuggingFace, analyzeImageForBriefCloudflare, analyzeReferenceImage, analyzeImageForBriefGroq, getStoredHuggingFaceKey, getStoredCloudflareId, getStoredGroqKey, getStoredAwsAccessKey, getStoredXaiKey, analyzeImageForBriefXai, analyzeReferenceImageXai } from '../services/externalService';
import { analyzeImageBedrock, analyzeReferenceImageBedrock } from '../services/awsService';

interface InputFormProps {
  onSubmit: (data: FormData) => void;
  onOpenSettings?: () => void;
  onStop?: () => void;
}

const defaultData: FormData = {
  brand: { name: '', tone_hint_optional: '', country_market_optional: 'ID' },
  product: { type: '', material: '', price_tier_optional: 'mid', platform: ['tiktok'], objective: 'conversion', main_angle_optional: 'problem-solution' },
  scrape: { source_url_optional: '', raw_text_optional: '' },
  constraints: { do_not_say_optional: [], must_include_optional: [], language: 'id', vo_duration_seconds: 30, scene_count: 5, ai_model: 'gemini-3-pro-preview', image_generator_model: 'gemini-3-pro-image-preview', variations_count: 1 },
  visual_settings: { camera_angle: 'Eye-level', lighting: 'Natural/Soft', art_style: 'Realistic/UGC', pacing: 'Medium', camera_movement_style: 'Handheld/Shaky', shot_type: 'Medium shot', visual_effects: 'None' },
  references: { face_description: '', outfit_description: '' }
};

export const InputForm: React.FC<InputFormProps> = ({ onSubmit, onOpenSettings, onStop }) => {
  // Ambil state dari Context
  const { loading: isLoading, formDataState: initialValues } = useAppContext();

  const [data, setData] = useState<FormData>(defaultData);
  const [isAnalyzingImage, setIsAnalyzingImage] = useState(false);
  const [isAnalyzingRef, setIsAnalyzingRef] = useState(false);
  const [visionProvider, setVisionProvider] = useState<'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'aws' | 'xai'>('gemini');
  const [awsVisionModel, setAwsVisionModel] = useState<string>('us.anthropic.claude-sonnet-4-6');
  const [awsReferenceModel, setAwsReferenceModel] = useState<string>('us.anthropic.claude-sonnet-4-6');
  const [referenceProvider, setReferenceProvider] = useState<'gemini' | 'huggingface' | 'cloudflare' | 'groq' | 'aws' | 'xai'>('gemini');
  const [lockToast, setLockToast] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'brand' | 'visual' | 'format' | 'context'>('brand');
  
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

  const checkProviderReady = (provider: string): boolean => {
      if (provider === 'huggingface' && !getStoredHuggingFaceKey()) return false;
      if (provider === 'cloudflare' && !getStoredCloudflareId()) return false;
      if (provider === 'groq' && !getStoredGroqKey()) return false;
      if (provider === 'aws' && !getStoredAwsAccessKey()) return false;
      if (provider === 'xai' && !getStoredXaiKey()) return false;
      return true;
  };

  const promptForKey = (provider: string) => {
      const shouldOpen = window.confirm(`${provider.toUpperCase()} API Key/Token is missing. Open Settings to configure?`);
      if (shouldOpen && onOpenSettings) onOpenSettings();
  };

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
                    analysis = await analyzeImageForBriefHuggingFace(base64String);
                } else if (visionProvider === 'cloudflare') {
                    analysis = await analyzeImageForBriefCloudflare(base64String);
                } else if (visionProvider === 'groq') {
                    analysis = await analyzeImageForBriefGroq(base64String);
                } else if (visionProvider === 'aws') {
                    analysis = await analyzeImageBedrock(base64String, mimeType, awsVisionModel);
                } else if (visionProvider === 'xai') {
                    analysis = await analyzeImageForBriefXai(base64String);
                } else {
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

  const handleReferenceUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'face' | 'outfit') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const providerToUse = referenceProvider;
    if (providerToUse !== 'gemini' && !checkProviderReady(providerToUse)) {
         promptForKey(providerToUse);
         if (e.target) e.target.value = '';
         return;
    }

    setIsAnalyzingRef(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
        const base64String = (reader.result as string).split(',')[1];
        
        try {
            let description = "";
            if (providerToUse === 'aws') {
                description = await analyzeReferenceImageBedrock(base64String, type, awsReferenceModel);
            } else if (providerToUse === 'xai') {
                description = await analyzeReferenceImageXai(base64String, type);
            } else if (providerToUse === 'gemini') {
                 const geminiAnalysis = await analyzeImageForBrief(base64String, file.type);
                 description = geminiAnalysis.raw_context || "A person/outfit matching the image.";
            } else {
                description = await analyzeReferenceImage(base64String, type, providerToUse as 'huggingface' | 'cloudflare' | 'groq');
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
            } else {
                throw new Error("Could not extract description.");
            }
        } catch (e: any) {
            console.error(e);
            if (e.message?.includes("Missing") || e.message?.includes("Credentials") || e.message?.includes("Key missing")) {
                 promptForKey(providerToUse);
            } else {
                 alert(`Failed to analyze reference with ${providerToUse}. ${e.message}`);
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
      
      {/* iOS 26 Style Tab Navigation */}
      <div className="flex p-1 bg-slate-100/80 backdrop-blur-xl rounded-2xl shadow-inner overflow-x-auto hide-scrollbar dark:bg-slate-800/80">
        <button type="button" onClick={() => setActiveTab('brand')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'brand' ? 'bg-white text-brand-600 shadow-sm scale-100 dark:bg-slate-700 dark:text-brand-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'}`}>
          <Type className="w-4 h-4"/> Brand
        </button>
        <button type="button" onClick={() => setActiveTab('visual')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'visual' ? 'bg-white text-amber-600 shadow-sm scale-100 dark:bg-slate-700 dark:text-amber-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'}`}>
          <Camera className="w-4 h-4"/> Visuals
        </button>
        <button type="button" onClick={() => setActiveTab('format')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'format' ? 'bg-white text-blue-600 shadow-sm scale-100 dark:bg-slate-700 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'}`}>
          <Settings2 className="w-4 h-4"/> Format
        </button>
        <button type="button" onClick={() => setActiveTab('context')} className={`flex-1 min-w-[100px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all duration-300 flex items-center justify-center gap-2 ${activeTab === 'context' ? 'bg-white text-emerald-600 shadow-sm scale-100 dark:bg-slate-700 dark:text-emerald-400' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 scale-95 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'}`}>
          <FileText className="w-4 h-4"/> Context
        </button>
      </div>

      <div className="relative min-h-[400px]">
      {/* Brand & Product Tab */}
      <div className={`transition-all duration-500 ${activeTab === 'brand' ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
      <div className="glass-panel p-4 md:p-5 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/40 relative mb-5 dark:bg-slate-900/50 dark:border-slate-700 dark:shadow-none">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
             <h3 className="text-slate-800 font-bold flex items-center gap-2 text-base dark:text-slate-200"><Type className="w-5 h-5 text-brand-500"/> Brand Identity</h3>
             
             <div className="flex items-center gap-2 w-full sm:w-auto">
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleImageUpload} className="hidden" />
                
                <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <button type="button" onClick={() => setVisionProvider('gemini')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'gemini' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Gemini Vision"><Zap className="w-3 h-3"/> Gemini</button>
                    <button type="button" onClick={() => setVisionProvider('aws')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'aws' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="AWS Bedrock (Claude 3)"><Cloud className="w-3 h-3"/> AWS</button>
                    <button type="button" onClick={() => setVisionProvider('groq')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'groq' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Groq Llama 3.2"><Eye className="w-3 h-3"/> Groq</button>
                    <button type="button" onClick={() => setVisionProvider('xai')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'xai' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="xAI (Grok)"><span className="font-mono font-bold">X</span> Grok</button>
                    <button type="button" onClick={() => setVisionProvider('huggingface')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'huggingface' ? 'bg-white text-yellow-600 shadow-sm dark:bg-slate-700 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Hugging Face"><Smile className="w-3 h-3"/> HF</button>
                    <button type="button" onClick={() => setVisionProvider('cloudflare')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${visionProvider === 'cloudflare' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Cloudflare Workers AI"><Cloud className="w-3 h-3"/> CF</button>
                </div>

                {visionProvider === 'aws' && (
                    <select 
                        value={awsVisionModel}
                        onChange={(e) => setAwsVisionModel(e.target.value)}
                        className="bg-slate-100 border border-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-700 font-medium w-32 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    >
                        <option value="us.anthropic.claude-sonnet-4-6">Claude 4.6 (US)</option>
                        <option value="us.anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet</option>
                        <option value="us.anthropic.claude-3-sonnet-20240229-v1:0">Claude 3 Sonnet</option>
                        <option value="us.meta.llama3-2-90b-instruct-v1:0">Llama 3.2 90B</option>
                    </select>
                )}

                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isAnalyzingImage || isLoading} className={`flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-xs transition-all font-semibold active:scale-95 whitespace-nowrap ${visionProvider === 'gemini' ? 'bg-brand-50 border-brand-200 text-brand-600 hover:bg-brand-100 dark:bg-brand-900/20 dark:border-brand-900/30 dark:text-brand-400' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}>
                    {isAnalyzingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <ImageIcon className="w-3 h-3" />}
                    {isAnalyzingImage ? "Scanning..." : "Auto-fill"}
                </button>
             </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1 dark:text-slate-400">Brand Name</label>
             <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.brand.name} onChange={(e) => handleChange('brand', 'name', e.target.value)} placeholder="e.g. GlowUp Co." />
          </div>
          <div className="space-y-1">
             <label className="text-xs font-semibold text-slate-500 ml-1 dark:text-slate-400">Brand Tone</label>
             <input type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.brand.tone_hint_optional} onChange={(e) => handleChange('brand', 'tone_hint_optional', e.target.value)} placeholder="e.g. Fun, Scientific, Bold" />
          </div>
          <div className="space-y-1 md:col-span-2">
             <label className="text-xs font-semibold text-slate-500 ml-1 dark:text-slate-400">Market Nuances (e.g., Regional Dialects, Cultural References)</label>
             <input type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.constraints.indonesian_nuances || ''} onChange={(e) => handleChange('constraints', 'indonesian_nuances', e.target.value)} placeholder="e.g. Jaksel slang, Javanese polite, Ramadan context" />
          </div>
        </div>

        {/* Face Model Section */}
          <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800">
             <div className="flex justify-between items-center mb-3">
                 <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2 dark:text-slate-400">
                    <User className="w-3 h-3" /> Face Model & Style
                 </h4>
                 <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 dark:bg-slate-800 dark:border-slate-700">
                    <button type="button" onClick={() => setReferenceProvider('gemini')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'gemini' ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Gemini Vision"><Zap className="w-3 h-3"/> Gemini</button>
                    <button type="button" onClick={() => setReferenceProvider('aws')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'aws' ? 'bg-white text-indigo-600 shadow-sm dark:bg-slate-700 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="AWS Bedrock"><Cloud className="w-3 h-3"/> AWS</button>
                    <button type="button" onClick={() => setReferenceProvider('groq')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'groq' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Groq"><Eye className="w-3 h-3"/> Groq</button>
                    <button type="button" onClick={() => setReferenceProvider('xai')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'xai' ? 'bg-white text-slate-800 shadow-sm dark:bg-slate-700 dark:text-slate-200' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="xAI (Grok)"><span className="font-mono">X</span></button>
                    <button type="button" onClick={() => setReferenceProvider('huggingface')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'huggingface' ? 'bg-white text-yellow-600 shadow-sm dark:bg-slate-700 dark:text-yellow-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Hugging Face"><Smile className="w-3 h-3"/> HF</button>
                    <button type="button" onClick={() => setReferenceProvider('cloudflare')} className={`px-2 py-1 rounded text-[10px] font-bold transition-all flex items-center gap-1 ${referenceProvider === 'cloudflare' ? 'bg-white text-orange-600 shadow-sm dark:bg-slate-700 dark:text-orange-400' : 'text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300'}`} title="Cloudflare"><Cloud className="w-3 h-3"/> CF</button>
                 </div>
             </div>

             {referenceProvider === 'aws' && (
                <div className="mb-3 flex justify-end">
                    <select 
                        value={awsReferenceModel}
                        onChange={(e) => setAwsReferenceModel(e.target.value)}
                        className="bg-slate-100 border border-slate-200 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-indigo-500 text-slate-700 font-medium w-48 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
                    >
                        <option value="us.anthropic.claude-sonnet-4-6">Claude 4.6 (US)</option>
                        <option value="us.anthropic.claude-3-5-sonnet-20241022-v2:0">Claude 3.5 Sonnet</option>
                        <option value="us.meta.llama4-maverick-17b-instruct-v1:0">Llama 4 Maverick</option>
                        <option value="us.meta.llama3-2-90b-instruct-v1:0">Llama 3.2 90B</option>
                    </select>
                </div>
             )}
             
             <div className="grid grid-cols-2 gap-4">
                 {/* Face Lock Card */}
                 <div 
                    onClick={() => data.references?.face_image_base64 ? null : faceInputRef.current?.click()}
                    className={`relative group cursor-pointer rounded-xl border-2 border-dashed transition-all p-2 flex flex-col items-center justify-center gap-2 h-auto min-h-[48px] ${data.references?.face_image_base64 ? 'border-pink-500 bg-pink-50 dark:bg-pink-900/20 dark:border-pink-500/50' : 'border-slate-200 hover:border-pink-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-pink-500/30 dark:hover:bg-slate-800'}`}
                 >
                    <input type="file" ref={faceInputRef} accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(e, 'face')} />
                    
                    {data.references?.face_image_base64 ? (
                        <div className="w-full flex flex-col items-center">
                            <div className="relative w-full h-12 mb-2">
                                <img src={`data:image/jpeg;base64,${data.references.face_image_base64}`} className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50" />
                                <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold text-pink-600 shadow-sm flex items-center gap-1 dark:bg-slate-900/90 dark:text-pink-400">
                                    <CheckCircle2 className="w-3 h-3" /> Locked
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setData(prev => ({...prev, references: {...prev.references, face_description: '', face_image_base64: ''}})); }}
                                    className="absolute top-2 left-2 z-10 bg-white/90 hover:bg-red-100 text-slate-500 hover:text-red-600 p-1 rounded-full shadow-sm transition-colors dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <div className="w-full px-1">
                                <label className="text-[10px] font-bold text-pink-600 uppercase mb-1 block dark:text-pink-400">Extracted Face Details</label>
                                <textarea 
                                    className="w-full text-xs p-2 rounded-lg border border-pink-200 bg-white/50 focus:bg-white focus:border-pink-400 outline-none resize-none h-12 dark:bg-slate-800 dark:border-pink-900/30 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:border-pink-500/50"
                                    value={data.references.face_description}
                                    onChange={(e) => setData(prev => ({...prev, references: {...prev.references, face_description: e.target.value}}))}
                                    placeholder="AI description of face..."
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-8 h-8 rounded-full bg-pink-100 text-pink-500 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform dark:bg-pink-900/20 dark:text-pink-400">
                                {isAnalyzingRef ? <Loader2 className="w-4 h-4 animate-spin"/> : <User className="w-4 h-4" />}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-500 group-hover:text-pink-600 dark:text-slate-400 dark:group-hover:text-pink-400">Upload Face</span>
                        </>
                    )}
                 </div>

                 {/* Outfit Lock Card */}
                 <div 
                    onClick={() => data.references?.outfit_image_base64 ? null : outfitInputRef.current?.click()}
                    className={`relative group cursor-pointer rounded-xl border-2 border-dashed transition-all p-4 flex flex-col items-center justify-center gap-2 h-auto min-h-[128px] ${data.references?.outfit_image_base64 ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 dark:border-indigo-500/50' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-indigo-500/30 dark:hover:bg-slate-800'}`}
                 >
                    <input type="file" ref={outfitInputRef} accept="image/*" className="hidden" onChange={(e) => handleReferenceUpload(e, 'outfit')} />
                    
                    {data.references?.outfit_image_base64 ? (
                        <div className="w-full flex flex-col items-center">
                            <div className="relative w-full h-32 mb-2">
                                <img src={`data:image/jpeg;base64,${data.references.outfit_image_base64}`} className="absolute inset-0 w-full h-full object-cover rounded-xl opacity-50" />
                                <div className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur px-2 py-1 rounded-full text-[10px] font-bold text-indigo-600 shadow-sm flex items-center gap-1 dark:bg-slate-900/90 dark:text-indigo-400">
                                    <CheckCircle2 className="w-3 h-3" /> Locked
                                </div>
                                <button 
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setData(prev => ({...prev, references: {...prev.references, outfit_description: '', outfit_image_base64: ''}})); }}
                                    className="absolute top-2 left-2 z-10 bg-white/90 hover:bg-red-100 text-slate-500 hover:text-red-600 p-1 rounded-full shadow-sm transition-colors dark:bg-slate-900/90 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                                </button>
                            </div>
                            <div className="w-full px-1">
                                <label className="text-[10px] font-bold text-indigo-600 uppercase mb-1 block dark:text-indigo-400">Extracted Outfit Details</label>
                                <textarea 
                                    className="w-full text-xs p-2 rounded-lg border border-indigo-200 bg-white/50 focus:bg-white focus:border-indigo-400 outline-none resize-none h-20 dark:bg-slate-800 dark:border-indigo-900/30 dark:text-slate-200 dark:focus:bg-slate-900 dark:focus:border-indigo-500/50"
                                    value={data.references.outfit_description}
                                    onChange={(e) => setData(prev => ({...prev, references: {...prev.references, outfit_description: e.target.value}}))}
                                    placeholder="AI description of outfit..."
                                    onClick={(e) => e.stopPropagation()}
                                />
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-500 flex items-center justify-center mb-1 group-hover:scale-110 transition-transform dark:bg-indigo-900/20 dark:text-indigo-400">
                                {isAnalyzingRef ? <Loader2 className="w-5 h-5 animate-spin"/> : <Shirt className="w-5 h-5" />}
                            </div>
                            <span className="text-xs font-semibold text-slate-500 group-hover:text-indigo-600 dark:text-slate-400 dark:group-hover:text-indigo-400">Upload Outfit</span>
                        </>
                    )}
                 </div>
             </div>
          </div>
      </div>

      {/* Product */}
      <div className="glass-panel p-4 md:p-5 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/40 dark:bg-slate-900/50 dark:border-slate-700 dark:shadow-none">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base dark:text-slate-200"><Tag className="w-5 h-5 text-purple-500"/> Product Specs</h3>
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.product.type} onChange={(e) => handleChange('product', 'type', e.target.value)} placeholder="Type (e.g. Serum) *" />
          <input required type="text" className="glass-input w-full p-3.5 rounded-xl placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.product.material} onChange={(e) => handleChange('product', 'material', e.target.value)} placeholder="Key Feature (e.g. Retinol) *" />
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" value={data.product.objective} onChange={(e) => handleChange('product', 'objective', e.target.value)}>
             <option className="bg-white dark:bg-slate-800" value="conversion">Goal: Conversion</option>
             <option className="bg-white dark:bg-slate-800" value="awareness">Goal: Awareness</option>
          </select>
          <select className="glass-input w-full p-3.5 rounded-xl text-base bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" value={data.product.main_angle_optional} onChange={(e) => handleChange('product', 'main_angle_optional', e.target.value)}>
             <option className="bg-white dark:bg-slate-800" value="problem-solution">Angle: Problem-Solution</option>
             <option className="bg-white dark:bg-slate-800" value="routine">Angle: Routine</option>
             <option className="bg-white dark:bg-slate-800" value="review">Angle: Review</option>
             <option className="bg-white dark:bg-slate-800" value="aesthetic">Angle: Aesthetic</option>
             <option className="bg-white dark:bg-slate-800" value="comparison">Angle: Comparison</option>
          </select>
        </div>
        <div className="flex gap-2">
          {['tiktok', 'reels', 'shorts'].map(p => (
            <button key={p} type="button" onClick={() => togglePlatform(p)} className={`flex-1 py-3 rounded-lg border flex items-center justify-center gap-2 transition-all font-medium text-sm active:scale-95 ${data.product.platform.includes(p as any) ? 'bg-purple-50 border-purple-300 text-purple-700 shadow-sm dark:bg-purple-900/20 dark:border-purple-500/50 dark:text-purple-400' : 'glass-input border-transparent text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800 dark:border-slate-700'}`}>
              <Smartphone className="w-4 h-4"/> <span className="capitalize">{p}</span>
            </button>
          ))}
        </div>
      </div>
      </div>

      {/* Visual Director Settings Tab */}
      <div className={`transition-all duration-500 ${activeTab === 'visual' ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
      <div className="glass-panel p-4 md:p-5 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/40 dark:bg-slate-900/50 dark:border-slate-700 dark:shadow-none">
         <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base dark:text-slate-200"><Camera className="w-5 h-5 text-amber-500"/> Visual Director</h3>
         
         <div className="grid md:grid-cols-3 gap-4 mb-4">
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Sun className="w-3 h-3"/> Lighting</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
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
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Camera className="w-3 h-3"/> Camera Angle</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
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
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Paintbrush className="w-3 h-3"/> Art Style</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
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
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Gauge className="w-3 h-3"/> Video Pacing</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
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
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Move className="w-3 h-3"/> Movement Style</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
                  value={data.visual_settings.camera_movement_style || 'Handheld/Shaky'} 
                  onChange={(e) => handleChange('visual_settings', 'camera_movement_style', e.target.value)}
               >
                  <option value="Handheld/Shaky">Handheld / UGC Style</option>
                  <option value="Static/Tripod">Static / Tripod</option>
                  <option value="Smooth/Gimbal">Smooth / Gimbal</option>
                  <option value="Dynamic/Whip-pans">Dynamic / Transitions</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Camera className="w-3 h-3"/> Shot Type</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
                  value={data.visual_settings.shot_type || 'Medium shot'} 
                  onChange={(e) => handleChange('visual_settings', 'shot_type', e.target.value)}
               >
                  <option value="Close-up">Close-up</option>
                  <option value="Medium shot">Medium shot</option>
                  <option value="Full shot">Full shot</option>
                  <option value="Wide shot">Wide shot</option>
                  <option value="Over-the-shoulder">Over-the-shoulder</option>
                  <option value="Point-of-view">Point-of-view (POV)</option>
               </select>
            </div>
            <div>
               <label className="text-xs font-semibold text-slate-500 ml-1 mb-1 block flex items-center gap-1 dark:text-slate-400"><Sparkles className="w-3 h-3"/> Visual Effects</label>
               <select 
                  className="glass-input w-full p-2.5 rounded-xl text-sm bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200" 
                  value={data.visual_settings.visual_effects || 'None'} 
                  onChange={(e) => handleChange('visual_settings', 'visual_effects', e.target.value)}
               >
                  <option value="None">None</option>
                  <option value="Glitch">Glitch</option>
                  <option value="VHS">VHS / Retro</option>
                  <option value="Film Grain">Film Grain</option>
                  <option value="Motion Blur">Motion Blur</option>
                  <option value="Lens Flare">Lens Flare</option>
                  <option value="Color Grading (Warm)">Color Grading (Warm)</option>
                  <option value="Color Grading (Cool)">Color Grading (Cool)</option>
               </select>
            </div>
         </div>
      </div>
      </div>

      {/* Format Settings (Scenes & Duration) Tab */}
      <div className={`transition-all duration-500 ${activeTab === 'format' ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
      <div className="glass-panel p-4 md:p-5 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/40 dark:bg-slate-900/50 dark:border-slate-700 dark:shadow-none">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base dark:text-slate-200"><Settings2 className="w-5 h-5 text-blue-500"/> Format Control</h3>
        
        <div className="space-y-6">
            
            {/* Model & Image Model Config */}
            <div className="grid md:grid-cols-3 gap-6">
                
                {/* Language Selector */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Globe className="w-4 h-4 text-emerald-400"/> Output Language</span>
                    </div>
                    <select 
                        value={data.constraints.language}
                        onChange={(e) => handleChange('constraints', 'language', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-emerald-500 focus:bg-white transition-all outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:bg-slate-900"
                    >
                        <option value="id">Indonesian (ID)</option>
                        <option value="en">English (EN)</option>
                    </select>
                </div>

                {/* Text Model - Limited to Gemini for Logic */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                        <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Cpu className="w-4 h-4 text-blue-400"/> AI Script Brain (VO Text)</span>
                    </div>
                    <select 
                        value={data.constraints.ai_model}
                        onChange={(e) => handleChange('constraints', 'ai_model', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-blue-500 focus:bg-white transition-all outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:bg-slate-900"
                    >
                        <optgroup label="xAI (Grok)">
                            <option value="grok-3">Grok 3 (Latest 2026)</option>
                            <option value="grok-2">Grok 2 (Stable)</option>
                            <option value="grok-beta">Grok</option>
                        </optgroup>
                        <optgroup label="Groq (Latest)">
                          
                            <option value="llama-3.3-70b-versatile">Llama 3.3 70B (Latest)</option>
                            <option value="llama-3.1-8b-instant">Llama 3.1 8B (Fastest)</option>
                        </optgroup>
                        <optgroup label="Gemini">
                            <option value="gemini-3-pro-preview">Gemini 3 Pro (Best Quality)</option>
                            <option value="gemini-3-flash-preview">Gemini 3 Flash (Free Tier / Fast)</option>
                        </optgroup>
                        <optgroup label="AWS Bedrock">
                            <option value="us.meta.llama4-maverick-17b-instruct-v1:0">Llama 4 Maverick (AWS US)</option>
                            <option value="us.anthropic.claude-sonnet-4-6">Claude 4.6 Sonnet (AWS US)</option>
                        </optgroup>
                    </select>
                </div>

                {/* Image/Video Generator Model - Integrated External Services */}
                <div>
                    <div className="flex justify-between text-sm mb-2">
                         <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Palette className="w-4 h-4 text-purple-400"/> Media Generator</span>
                    </div>
                    <select 
                        value={data.constraints.image_generator_model}
                        onChange={(e) => handleChange('constraints', 'image_generator_model', e.target.value)}
                        className="w-full h-[72px] bg-white/50 border border-slate-200 rounded-xl px-4 text-sm text-slate-700 focus:border-purple-500 focus:bg-white transition-all outline-none dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:focus:bg-slate-900"
                    >
                        <optgroup label="xAI (Grok)">
                             <option value="grok-2-image">Grok 2 Image (Flux)</option>
                        </optgroup>
                        <optgroup label="Google (Default)">
                            <option value="gemini-3-pro-image-preview">Gemini 3 Image (Best Quality)</option>
                            <option value="gemini-2.5-flash-image">Gemini 2.5 Image (Free Tier / Fast)</option>
                            <option value="imagen-3.0-generate-001">Imagen 3 (Photorealistic)</option>
                        </optgroup>
                        <optgroup label="AWS Bedrock">
                            <option value="us.amazon.titan-image-generator-v2:0">Titan Image Gen v2 (US)</option>
                        </optgroup>
                        <optgroup label="Cloudflare (New)">
                             <option value="cf-flux-schnell">Flux 1 Schnell</option>
<option value="cf-flux-2-dev">Flux 2 dev</option>
<option value="cf-flux-2-klein">Flux 2 klein</option>
<option value="cf-stable-diffusion-xl-lightning">Stable diffusion xl lightning</option>
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
                        <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Layers className="w-4 h-4 text-blue-400"/> Scene Count</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500/50">{data.constraints.scene_count || 5} Scenes</span>
                    </div>
                    <input 
                        type="range" 
                        min="3" 
                        max="10" 
                        step="1" 
                        value={data.constraints.scene_count || 5} 
                        onChange={(e) => handleSceneCountChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500 dark:bg-slate-700"
                    />
                </div>

                {/* Duration Slider */}
                <div>
                    <div className="flex justify-between text-sm mb-3">
                        <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Clock className="w-4 h-4 text-blue-400"/> Duration</span>
                        <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded text-xs border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-500/50">{data.constraints.vo_duration_seconds}s</span>
                    </div>
                    <input 
                        type="range" 
                        min="15" 
                        max="90" 
                        step="5" 
                        value={data.constraints.vo_duration_seconds} 
                        onChange={(e) => handleChange('constraints', 'vo_duration_seconds', parseInt(e.target.value))}
                        className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-500 dark:bg-slate-700"
                    />
                </div>
            </div>

            {/* A/B Testing Variations */}
            <div>
                 <div className="flex justify-between text-sm mb-3">
                    <span className="text-slate-500 flex items-center gap-2 font-medium dark:text-slate-400"><Split className="w-4 h-4 text-emerald-500"/> Creative Variations (A/B Test)</span>
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded text-xs border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-500/50">{data.constraints.variations_count} Variations</span>
                </div>
                <div className="flex gap-2">
                    {[1, 2, 3].map(count => (
                        <button
                            key={count}
                            type="button"
                            onClick={() => handleChange('constraints', 'variations_count', count)}
                            className={`flex-1 py-3 rounded-lg border text-sm font-bold transition-all ${data.constraints.variations_count === count ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-sm dark:bg-emerald-900/20 dark:border-emerald-500/50 dark:text-emerald-400' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-white dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700'}`}
                        >
                            {count} {count === 1 ? 'Script' : 'Scripts'}
                        </button>
                    ))}
                </div>
            </div>

        </div>
      </div>
      </div>

      {/* Context Tab */}
      <div className={`transition-all duration-500 ${activeTab === 'context' ? 'opacity-100 translate-y-0 relative z-10' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
      <div className="glass-panel p-4 md:p-5 rounded-3xl border border-white/40 shadow-xl shadow-slate-200/40 dark:bg-slate-900/50 dark:border-slate-700 dark:shadow-none">
        <h3 className="text-slate-800 font-bold mb-4 flex items-center gap-2 text-base dark:text-slate-200"><FileText className="w-5 h-5 text-emerald-500"/> Context (Optional)</h3>
        <textarea className="glass-input w-full p-3.5 rounded-xl h-24 placeholder-slate-400 text-base dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:placeholder-slate-600" value={data.scrape.raw_text_optional} onChange={(e) => handleChange('scrape', 'raw_text_optional', e.target.value)} placeholder="Paste product details, facts, or competitor copy here..." />
      </div>
      </div>
      </div>

      <button 
        type="button"
        onClick={() => {
            if (isLoading) {
                if (onStop) onStop();
                return;
            }

            if (activeTab === 'brand') setActiveTab('visual');
            else if (activeTab === 'visual') setActiveTab('format');
            else if (activeTab === 'format' || activeTab === 'context') {
                if (data.product.platform.length === 0) return alert("Select platform");
                onSubmit(data);
            }
        }}
        className={`w-full font-black text-lg py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mt-6 ${
            isLoading 
            ? 'bg-red-500 text-white hover:bg-red-600 border-red-600 shadow-red-500/30'
            : activeTab === 'brand' || activeTab === 'visual' 
            ? 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700 dark:hover:bg-slate-700' 
            : 'bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white shadow-brand-500/30'
        }`}
      >
        {isLoading ? <Square className="w-5 h-5 fill-current" /> : (activeTab === 'brand' || activeTab === 'visual' ? <Move className="w-5 h-5 rotate-90" /> : <Sparkles className="w-6 h-6 fill-white" />)}
        {isLoading ? "STOP GENERATION" : (activeTab === 'brand' || activeTab === 'visual' ? "NEXT STEP" : "GENERATE CAMPAIGN")}
      </button>
    </form>
  );
};