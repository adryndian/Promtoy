
import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, Check, Zap, Cpu, Mic, Smile, Cloud, Info } from 'lucide-react';
import { getStoredHuggingFaceKey, setStoredHuggingFaceKey, getStoredGroqKey, setStoredGroqKey, getStoredCloudflareId, setStoredCloudflareId, getStoredCloudflareToken, setStoredCloudflareToken, getStoredAwsAccessKey, setStoredAwsAccessKey, getStoredAwsSecretKey, setStoredAwsSecretKey, getStoredAwsRegion, setStoredAwsRegion } from '../services/externalService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [huggingFaceKey, setHuggingFaceKey] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [elevenLabsKey, setElevenLabsKey] = useState('');
  const [togetherKey, setTogetherKey] = useState('');
  const [dashscopeKey, setDashscopeKey] = useState('');
  const [cloudflareId, setCloudflareId] = useState('');
  const [cloudflareToken, setCloudflareToken] = useState('');
  const [awsAccessKey, setAwsAccessKey] = useState('');
  const [awsSecretKey, setAwsSecretKey] = useState('');
  const [awsRegion, setAwsRegion] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setHuggingFaceKey(getStoredHuggingFaceKey());
      setGroqKey(getStoredGroqKey());
      
      // Load stored or default if not set manually by user
      const storedId = getStoredCloudflareId();
      setCloudflareId(storedId || "2472636ad2b8833398abf45b94a93f6d");

      const storedToken = getStoredCloudflareToken();
      setCloudflareToken(storedToken || "tJkuEqm9zX9emiCo_quuXVGTKLhZeo04Nm5-5_6N");

      setGeminiKey(localStorage.getItem('GEMINI_API_KEY') || '');
      setElevenLabsKey(localStorage.getItem('ELEVENLABS_API_KEY') || '');
      setTogetherKey(localStorage.getItem('TOGETHER_API_KEY') || '');
      setDashscopeKey(localStorage.getItem('DASHSCOPE_API_KEY') || '');

      setAwsAccessKey(getStoredAwsAccessKey());
      setAwsSecretKey(getStoredAwsSecretKey());
      setAwsRegion(getStoredAwsRegion());
    }
  }, [isOpen]);

  const handleSave = () => {
    setStoredHuggingFaceKey(huggingFaceKey);
    setStoredGroqKey(groqKey);
    setStoredCloudflareId(cloudflareId);
    setStoredCloudflareToken(cloudflareToken);
    setStoredAwsAccessKey(awsAccessKey);
    setStoredAwsSecretKey(awsSecretKey);
    setStoredAwsRegion(awsRegion);
    
    if (geminiKey.trim()) {
        localStorage.setItem('GEMINI_API_KEY', geminiKey.trim());
    } else {
        localStorage.removeItem('GEMINI_API_KEY');
    }

    if (elevenLabsKey.trim()) {
        localStorage.setItem('ELEVENLABS_API_KEY', elevenLabsKey.trim());
    } else {
        localStorage.removeItem('ELEVENLABS_API_KEY');
    }

    if (togetherKey.trim()) {
        localStorage.setItem('TOGETHER_API_KEY', togetherKey.trim());
    } else {
        localStorage.removeItem('TOGETHER_API_KEY');
    }

    if (dashscopeKey.trim()) {
        localStorage.setItem('DASHSCOPE_API_KEY', dashscopeKey.trim());
    } else {
        localStorage.removeItem('DASHSCOPE_API_KEY');
    }

    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      onClose();
      window.location.reload(); 
    }, 800);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-white/20 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 w-full max-w-md rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[85vh] overflow-y-auto">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 -mr-2 -mt-2 text-slate-400 hover:text-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-brand-50 rounded-lg border border-brand-200">
            <Key className="w-5 h-5 text-brand-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">System Settings</h2>
            <p className="text-xs text-slate-500">API Keys & Model Configuration</p>
          </div>
        </div>

        <div className="space-y-6">
            
          {/* Gemini Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-emerald-500" />
                    <label className="text-sm font-bold text-slate-700">Gemini API Key</label>
                </div>
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Primary brain for Script Logic, Analysis, and Veo Video.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Groq Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-orange-600" />
                    <label className="text-sm font-bold text-slate-700">Groq API Key</label>
                </div>
                <a href="https://console.groq.com/keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Unlock blazing fast models like Llama 3.3 and Mixtral.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={groqKey}
                  onChange={(e) => setGroqKey(e.target.value)}
                  placeholder="gsk_..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* AWS Bedrock Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-blue-600" />
                    <label className="text-sm font-bold text-slate-700">AWS Bedrock</label>
                </div>
                <a href="https://console.aws.amazon.com/iam/home" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Keys <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Titan Image Generator & Nova Reel (Video).
             </p>
             <div className="space-y-2">
                <input 
                  type="text" 
                  value={awsAccessKey}
                  onChange={(e) => setAwsAccessKey(e.target.value)}
                  placeholder="AWS Access Key ID"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder-slate-400"
                />
                <input 
                  type="password" 
                  value={awsSecretKey}
                  onChange={(e) => setAwsSecretKey(e.target.value)}
                  placeholder="AWS Secret Access Key"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder-slate-400"
                />
                <input 
                  type="text" 
                  value={awsRegion}
                  onChange={(e) => setAwsRegion(e.target.value)}
                  placeholder="Region (e.g. us-west-2)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Cloudflare Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-orange-600" />
                    <label className="text-sm font-bold text-slate-700">Cloudflare Workers AI</label>
                </div>
                <a href="https://developers.cloudflare.com/workers-ai/get-started/rest-api/" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Token <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Used for Vision Analysis (Llama 3.2) & Flux Schnell generation.
             </p>
             <div className="space-y-2">
                <input 
                  type="text" 
                  value={cloudflareId}
                  onChange={(e) => setCloudflareId(e.target.value)}
                  placeholder="Account ID (e.g. 840...)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors placeholder-slate-400"
                />
                <input 
                  type="password" 
                  value={cloudflareToken}
                  onChange={(e) => setCloudflareToken(e.target.value)}
                  placeholder="API Token (e.g. uK9...)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Hugging Face Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Smile className="w-4 h-4 text-yellow-500" />
                    <label className="text-sm font-bold text-slate-700">Hugging Face Token</label>
                </div>
                <a href="https://huggingface.co/settings/tokens" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Token <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Used for Vision Analysis (Llama 3.2), FLUX.1-dev, and Video.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={huggingFaceKey}
                  onChange={(e) => setHuggingFaceKey(e.target.value)}
                  placeholder="hf_..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-yellow-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Together AI Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-blue-500" />
                    <label className="text-sm font-bold text-slate-700">Together AI</label>
                </div>
                <a href="https://api.together.xyz/settings/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Supports FLUX.1 and Llama models.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={togetherKey}
                  onChange={(e) => setTogetherKey(e.target.value)}
                  placeholder="together_..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-blue-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Dashscope (Qwen) Section */}
          <div className="space-y-3 pb-6 border-b border-slate-100">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-purple-600" />
                    <label className="text-sm font-bold text-slate-700">Dashscope (Qwen/Wanx)</label>
                </div>
                <a href="https://dashscope.console.aliyun.com/apiKey" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Alibaba Cloud models: Qwen, Wanx (Image/Video), CosyVoice.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={dashscopeKey}
                  onChange={(e) => setDashscopeKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-purple-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* ElevenLabs Section */}
          <div className="space-y-3 pb-2">
             <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-orange-500" />
                    <label className="text-sm font-bold text-slate-700">ElevenLabs API</label>
                </div>
                <a href="https://elevenlabs.io/app/settings/api-keys" target="_blank" rel="noreferrer" className="text-[10px] text-brand-600 hover:underline flex items-center gap-1">
                   Get Key <ExternalLink className="w-3 h-3" />
                </a>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed">
                Optional. High-quality AI voices.
             </p>
             <div className="relative">
                <input 
                  type="password" 
                  value={elevenLabsKey}
                  onChange={(e) => setElevenLabsKey(e.target.value)}
                  placeholder="xi-..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:border-orange-500 focus:bg-white transition-colors placeholder-slate-400"
                />
             </div>
          </div>

          {/* Help / Troubleshooting */}
          <div className="mt-8 pt-6 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-3">
                  <Info className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-bold text-slate-700">Troubleshooting Guide</h3>
              </div>
              <div className="bg-slate-50 rounded-xl p-4 text-[11px] text-slate-600 space-y-2 leading-relaxed border border-slate-200">
                  <p><strong>Hugging Face:</strong> Ensure your token has `read` permissions. For FLUX.1-dev, you must accept the license agreement on the model page first. If it fails, try SDXL.</p>
                  <p><strong>Cloudflare:</strong> Verify your Account ID and API Token have `Workers AI` permissions. The `Flux 1 Schnell` model is currently in beta on CF.</p>
                  <p><strong>AWS Bedrock:</strong> Ensure your IAM user has `BedrockFullAccess` policy and you have requested model access in the AWS Bedrock Console (us-west-2 region recommended).</p>
              </div>
          </div>

          <button 
            onClick={handleSave}
            className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 mt-4 shadow-lg active:scale-95"
          >
             {saved ? <Check className="w-4 h-4"/> : <Save className="w-4 h-4" />}
             {saved ? 'Settings Saved' : 'Save & Reload'}
          </button>
        </div>
      </div>
    </div>
  );
};
