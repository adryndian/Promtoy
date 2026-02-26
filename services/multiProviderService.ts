import { GeneratedAsset } from '../types';

// --- TOGETHER AI ---

// Ganti fungsi Together AI
export const generateImageTogether = async (prompt: string, model: string = "black-forest-labs/FLUX.1-schnell"): Promise<string> => {
    const apiKey = localStorage.getItem('TOGETHER_API_KEY');
    if (!apiKey) throw new Error("Together AI API Key missing. Please set it in Settings.");

    try {
        // 🔥 Pastikan fetch mengarah ke '/api/proxy' 🔥
        const response = await fetch('/api/proxy', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider: "TogetherAI",
                url: "https://api.together.xyz/v1/images/generations",
                headers: { 
                    "Authorization": `Bearer ${apiKey}`, 
                    "Content-Type": "application/json" 
                },
                payload: {
                    model: model,
                    prompt: prompt,
                    width: 1024,
                    height: 1024,
                    steps: 4,
                    n: 1,
                    response_format: "b64_json"
                },
                isBlob: false // Together mengembalikan JSON, bukan Blob
            })
        });

        if (!response.ok) {
            const errData = await response.json() as any;
            throw new Error(errData.error || "Together AI Proxy Failed");
        }
        
        const data = await response.json() as any;
        // Together AI mengembalikan base64 murni di dalam properti b64_json
        return `data:image/png;base64,${data.data[0].b64_json}`;
    } catch (error) {
        console.error("Together AI Error:", error);
        throw error;
    }
};


// --- DASHSCOPE (QWEN/WANX) ---

// Note: Dashscope usually requires a server-side proxy to avoid CORS issues if called from browser,
// OR we can try calling directly if they support CORS. Most enterprise APIs don't.
// We will assume we need a proxy, but for now let's try direct call or use a simple fetch.
// If CORS fails, we might need to add a proxy route in server.ts.
// Given the pattern, let's assume we might need a proxy. 
// However, for this prototype, let's try direct first. If it fails, I'll add a proxy route.
// Actually, Dashscope API (Aliyun) often has strict CORS.
// I will implement it here, but if it fails, I'll need to add a proxy.

const DASHSCOPE_API_URL = "https://dashscope-intl.aliyuncs.com/api/v1"; // Intl endpoint might be better for CORS?
// Or "https://dashscope.aliyuncs.com/api/v1"

export const generateImageDashscope = async (prompt: string): Promise<string> => {
    const apiKey = localStorage.getItem('DASHSCOPE_API_KEY');
    if (!apiKey) throw new Error("Dashscope API Key missing. Please check Settings.");

    // Wanx Image Generation (wanx-v1)
    // Asynchronous task usually.
    
    try {
        // 1. Submit Task
        const response = await fetch(`${DASHSCOPE_API_URL}/services/aigc/text2image/generation`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable" // Async mode
            },
            body: JSON.stringify({
                model: "wanx-v1",
                input: {
                    prompt: prompt
                },
                parameters: {
                    style: "<auto>",
                    size: "1024*1024",
                    n: 1
                }
            })
        });

        if (!response.ok) {
             const err = await response.json() as any;
             throw new Error(err.message || "Dashscope Task Submission Failed");
        }

        const taskData = await response.json() as any;
        const taskId = taskData.output.task_id;

        // 2. Poll for Result
        let status = "PENDING";
        let imageUrl = "";
        
        while (status === "PENDING" || status === "RUNNING") {
            await new Promise(r => setTimeout(r, 2000));
            const check = await fetch(`${DASHSCOPE_API_URL}/tasks/${taskId}`, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const checkData = await check.json() as any;
            status = checkData.output.task_status;
            
            if (status === "SUCCEEDED") {
                imageUrl = checkData.output.results[0].url;
            } else if (status === "FAILED") {
                throw new Error(checkData.output.message || "Dashscope Generation Failed");
            }
        }

        // Dashscope returns a URL. We might want to proxy it or return it directly.
        // Returning URL directly is fine for <img> tags usually.
        return imageUrl;

    } catch (error) {
        console.error("Dashscope Image Error:", error);
        throw error;
    }
};

export const generateVideoDashscope = async (prompt: string, imageBase64?: string): Promise<string> => {
    const apiKey = localStorage.getItem('DASHSCOPE_API_KEY');
    if (!apiKey) throw new Error("Dashscope API Key missing.");

    // Wanx Video (wanx-v1)
    try {
        const payload: any = {
            model: "wanx-v1",
            input: {
                prompt: prompt
            },
            parameters: {}
        };

        if (imageBase64) {
             // Wanx supports image-to-video?
             // Documentation says input.ref_img_url. 
             // We can't pass base64 directly usually.
             // For now, text-to-video only unless we upload image first.
             // We will skip image input for this prototype unless we have a URL.
        }

        const response = await fetch(`${DASHSCOPE_API_URL}/services/aigc/text2video/generation`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "X-DashScope-Async": "enable"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
             const err = await response.json() as any;
             throw new Error(err.message || "Dashscope Video Task Failed");
        }

        const taskData = await response.json() as any;
        const taskId = taskData.output.task_id;

        let status = "PENDING";
        let videoUrl = "";

        while (status === "PENDING" || status === "RUNNING") {
            await new Promise(r => setTimeout(r, 5000)); // Video takes longer
            const check = await fetch(`${DASHSCOPE_API_URL}/tasks/${taskId}`, {
                headers: { "Authorization": `Bearer ${apiKey}` }
            });
            const checkData = await check.json() as any;
            status = checkData.output.task_status;
            
            if (status === "SUCCEEDED") {
                videoUrl = checkData.output.results[0].url;
            } else if (status === "FAILED") {
                throw new Error(checkData.output.message || "Dashscope Video Failed");
            }
        }

        return videoUrl;

    } catch (error) {
        console.error("Dashscope Video Error:", error);
        throw error;
    }
};
