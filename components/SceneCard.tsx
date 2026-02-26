import React from 'react';
import { Scene } from '../types';
// Pastikan Loader2 dan Monitor ada di daftar di bawah ini:
import { Copy, Check, Clapperboard, Play, Loader2, Mic, Download, Pause, Image, Settings2, Sparkles, Monitor, Tablet, Smartphone, Maximize2, X, Film, Wand2, Video as VideoIcon, Volume2, SlidersHorizontal, Info, FileText, FileJson, Printer, Headphones, Palette, Aperture, Layers, Split, Smile, ChevronDown, ChevronUp, Lightbulb, Target, Shield, Users, Brain, Megaphone, RefreshCw, ChevronRight } from 'lucide-react';



interface SceneCardProps {
    scene: Scene;
    idx: number;
    activeVariationIndex: number;
    aspectRatio: string;
    ttsProvider: string;
    activeAudio: HTMLAudioElement | null;
    playingIdx: number | null;
    loadingIdx: number | null;
    loadingImageIdx: number | null;
    loadingVideoIdx: number | null;
    previewImages: Record<string, string>;
    previewVideos: Record<string, string>;
    audioUrls: Record<string, string>;
    audioHistory: Record<string, any[]>;
    copiedSection: string | null;
    handleTogglePlay: (text: string, idx: number, force?: boolean) => void;
    handleGeneratePreview: (scene: Scene, idx: number) => void;
    handleGenerateVideo: (scene: Scene, idx: number) => void;
    handleDownload: (url: string, filename: string) => void;
    copyToClipboard: (label: string, text: string) => void;
    setViewModalContent: (content: {type: 'image' | 'video', url: string} | null) => void;
}

export const SceneCard = React.memo(({
    scene, idx, activeVariationIndex, aspectRatio, ttsProvider,
    activeAudio, playingIdx, loadingIdx, loadingImageIdx, loadingVideoIdx,
    previewImages, previewVideos, audioUrls, audioHistory, copiedSection,
    handleTogglePlay, handleGeneratePreview, handleGenerateVideo,
    handleDownload, copyToClipboard, setViewModalContent
}: SceneCardProps) => {

    const cacheKey = `${activeVariationIndex}-${idx}`;
    const structuredPrompts = scene.media_prompt_details;

    return (
        <div className="group/card relative bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-500 overflow-hidden dark:bg-slate-900 dark:border-slate-700">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-slate-100 group-hover/card:bg-brand-500 transition-colors dark:bg-slate-800"></div>
            
            <div className="p-5 md:p-7 pl-8 md:pl-10">
                <div className="flex flex-col md:flex-row gap-8">
                    
                    {/* LEFT COLUMN: VISUALS & MEDIA */}
                    <div className="w-full md:w-5/12 space-y-5">
                        <div className="flex md:hidden items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-slate-300 uppercase tracking-widest dark:text-slate-600">Scene {idx + 1}</span>
                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-bold rounded-full dark:bg-slate-800 dark:text-slate-400">{scene.seconds}s</span>
                            </div>
                        </div>

                        {/* Media Preview Area */}
                        <div className={`relative w-full rounded-xl overflow-hidden bg-slate-900 shadow-inner border border-slate-200 group/media ${aspectRatio === "9:16" ? "aspect-[9/16]" : aspectRatio === "16:9" ? "aspect-video" : "aspect-square"} dark:bg-slate-950 dark:border-slate-700`}>
                            
                            {!previewVideos[cacheKey] && !previewImages[cacheKey] && loadingImageIdx !== idx && loadingVideoIdx !== idx && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-50/50 backdrop-blur-[2px] opacity-100 transition-opacity z-10 p-4 text-center dark:bg-slate-800/50">
                                    <div className="mb-3 p-3 bg-white rounded-full shadow-sm dark:bg-slate-700">
                                        <Clapperboard className="w-6 h-6 text-slate-300 dark:text-slate-500" />
                                    </div>
                                    <p className="text-xs font-medium text-slate-400 mb-4 dark:text-slate-500">Generate visual preview</p>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => handleGeneratePreview(scene, idx)}
                                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-brand-600 hover:border-brand-200 hover:shadow-sm transition-all active:scale-95 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:text-brand-400"
                                        >
                                            <Image className="w-3.5 h-3.5" /> Image
                                        </button>
                                        {(structuredPrompts?.video_prompt || scene.video_prompt) && (
                                            <button 
                                                onClick={() => handleGenerateVideo(scene, idx)}
                                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-white border border-slate-200 text-slate-600 hover:text-indigo-600 hover:border-indigo-200 hover:shadow-sm transition-all active:scale-95 dark:bg-slate-800 dark:border-slate-600 dark:text-slate-300 dark:hover:text-indigo-400"
                                            >
                                                <VideoIcon className="w-3.5 h-3.5" /> Video
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* LOADING STATE */}
                            {(loadingImageIdx === idx || loadingVideoIdx === idx) && (
                                <div className="absolute inset-0 z-20 bg-white flex flex-col items-center justify-center dark:bg-slate-900">
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
                                <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md dark:bg-indigo-900/20 dark:text-indigo-400">
                                    <Clapperboard className="w-3.5 h-3.5" />
                                </div>
                                <span className="text-xs font-bold text-slate-700 uppercase tracking-wide dark:text-slate-300">Visual Direction</span>
                            </div>
                            <p className="text-sm text-slate-600 leading-relaxed font-medium dark:text-slate-400">
                                {scene.visual_description}
                            </p>
                        </div>

                        {/* Technical Prompts (Compact) */}
                        {structuredPrompts && (
                            <div className="space-y-2">
                                <details className="group/details">
                                    <summary className="flex items-center gap-2 cursor-pointer text-[10px] font-bold text-slate-400 uppercase tracking-wider hover:text-brand-600 transition-colors select-none dark:hover:text-brand-400">
                                        <ChevronRight className="w-3 h-3 group-open/details:rotate-90 transition-transform" />
                                        Technical Prompts
                                    </summary>
                                    <div className="mt-3 space-y-3 pl-2 border-l border-slate-100 dark:border-slate-700">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Image Prompt</span>
                                                <button onClick={() => copyToClipboard(`img-p-${idx}`, structuredPrompts.image_prompt)} className="text-slate-300 hover:text-brand-500 dark:text-slate-600 dark:hover:text-brand-400"><Copy className="w-3 h-3"/></button>
                                            </div>
                                            <code className="block text-[10px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 font-mono leading-relaxed dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400">{structuredPrompts.image_prompt}</code>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400">Video Prompt</span>
                                                <button onClick={() => copyToClipboard(`vid-p-${idx}`, structuredPrompts.video_prompt)} className="text-slate-300 hover:text-indigo-500 dark:text-slate-600 dark:hover:text-indigo-400"><Copy className="w-3 h-3"/></button>
                                            </div>
                                            <code className="block text-[10px] text-indigo-600/80 bg-indigo-50/30 p-2 rounded border border-indigo-50 font-mono leading-relaxed dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-900/30">{structuredPrompts.video_prompt}</code>
                                        </div>
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: SCRIPT & AUDIO */}
                    <div className="w-full md:w-7/12 flex flex-col">
                        <div className="hidden md:flex items-center justify-between mb-6 border-b border-slate-100 pb-4 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-black text-slate-300 uppercase tracking-widest dark:text-slate-600">Scene {idx + 1}</span>
                                <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-full dark:bg-slate-800 dark:text-slate-400">{scene.seconds}s</span>
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => copyToClipboard(`scene-${idx}`, JSON.stringify(scene, null, 2))} className="p-1.5 text-slate-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors dark:hover:bg-brand-900/20 dark:hover:text-brand-400" title="Copy JSON">
                                    {copiedSection === `scene-${idx}` ? <Check className="w-4 h-4"/> : <Copy className="w-4 h-4"/>}
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 space-y-6">
                            
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <div className="p-1.5 bg-rose-50 text-rose-500 rounded-md dark:bg-rose-900/20 dark:text-rose-400">
                                            <Mic className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wide">Voiceover</span>
                                    </div>
                                    <button onClick={() => copyToClipboard(`script-${idx}`, scene.audio_script)} className="text-xs text-slate-400 hover:text-brand-600 transition-colors dark:hover:text-brand-400">
                                        {copiedSection === `script-${idx}` ? "Copied" : "Copy"}
                                    </button>
                                </div>
                                <div className="pl-4 border-l-2 border-rose-100 dark:border-rose-900/30">
                                    <p className="font-serif text-xl md:text-2xl text-slate-800 leading-relaxed dark:text-slate-200">
                                        "{scene.audio_script}"
                                    </p>
                                </div>
                            </div>

                            {scene.on_screen_text && (
                                <div className="bg-amber-50/50 border border-amber-100 rounded-xl p-4 dark:bg-amber-900/20 dark:border-amber-900/30">
                                    <div className="flex items-center gap-2 mb-2">
                                        <div className="p-1 bg-amber-100 text-amber-600 rounded dark:bg-amber-900/40 dark:text-amber-400">
                                            <Monitor className="w-3 h-3" />
                                        </div>
                                        <span className="text-[10px] font-bold text-amber-600/70 uppercase tracking-wider dark:text-amber-400/70">Text Overlay</span>
                                    </div>
                                    <p className="text-amber-900 font-bold text-lg tracking-tight dark:text-amber-200">{scene.on_screen_text}</p>
                                </div>
                            )}
                        </div>

                        <div className="mt-8 pt-6 border-t border-slate-100 flex items-center gap-3 dark:border-slate-700">
                            <button 
                                onClick={() => handleTogglePlay(scene.audio_script as string, idx)} 
                                disabled={loadingIdx === idx}
                                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 ${
                                    playingIdx === idx 
                                    ? 'bg-rose-50 text-rose-500 hover:bg-rose-100 border border-rose-200 dark:bg-rose-900/20 dark:text-rose-400 dark:border-rose-900/30 dark:hover:bg-rose-900/30' 
                                    : 'bg-slate-900 hover:bg-slate-800 text-white shadow-lg shadow-slate-900/20 dark:bg-brand-600 dark:hover:bg-brand-500 dark:shadow-brand-900/20'
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

                            <button
                                onClick={() => handleTogglePlay(scene.audio_script as string, idx, true)}
                                disabled={loadingIdx === idx}
                                className="p-3 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-all border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-400"
                                title="Regenerate Audio"
                            >
                                <RefreshCw className={`w-5 h-5 ${loadingIdx === idx ? 'animate-spin' : ''}`} />
                            </button>

                            {audioHistory[`${activeVariationIndex}-${idx}`] && audioHistory[`${activeVariationIndex}-${idx}`].length > 0 && (
                                <div className="relative group">
                                    <button className="p-3 rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-brand-600 transition-all border border-slate-200 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-400 dark:hover:text-brand-400">
                                        <Headphones className="w-5 h-5" />
                                    </button>
                                    <div className="absolute bottom-full right-0 mb-2 w-56 bg-white rounded-xl shadow-xl border border-slate-100 p-2 hidden group-hover:block z-50 dark:bg-slate-800 dark:border-slate-700">
                                        <div className="text-xs font-bold text-slate-400 px-2 py-1 uppercase border-b border-slate-50 mb-1 dark:border-slate-700">Audio History</div>
                                        <div className="max-h-48 overflow-y-auto no-scrollbar">
                                            {audioHistory[`${activeVariationIndex}-${idx}`].map((h, hIdx) => (
                                                <div key={hIdx} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg cursor-pointer group/item dark:hover:bg-slate-700" onClick={() => {
                                                    const audio = new Audio(h.url);
                                                    audio.play();
                                                }}>
                                                    <div className="text-xs overflow-hidden">
                                                        <div className="font-medium text-slate-700 truncate dark:text-slate-300">{h.model}</div>
                                                        <div className="text-[10px] text-slate-400">{new Date(h.timestamp).toLocaleTimeString()}</div>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); handleDownload(h.url, `history-${hIdx}.mp3`); }} className="text-slate-300 hover:text-brand-500 opacity-0 group-hover/item:opacity-100 transition-opacity dark:text-slate-500 dark:hover:text-brand-400">
                                                        <Download className="w-3 h-3" />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {audioUrls[cacheKey] && (
                                <button 
                                    onClick={() => handleDownload(audioUrls[cacheKey] as string, `scene-${idx+1}-audio.mp3`)}
                                    className="p-3 rounded-xl bg-white hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-colors border border-slate-200 active:scale-95 shadow-sm dark:bg-slate-800 dark:hover:bg-slate-700 dark:border-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
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
});