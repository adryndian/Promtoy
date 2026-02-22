
import { FormData, GeneratedAsset } from "../types";

// Service to handle interactions with Hugging Face, Groq, and Cloudflare
const HUGGINGFACE_API_URL = "https://api-inference.huggingface.co/models/";
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// Using a CORS proxy to bypass browser restrictions for Cloudflare REST API calls from client-side
const CORSPROXY_HOST = "https://corsproxy.io/?url=";
const CLOUDFLARE_BASE_URL = "https://api.cloudflare.com/client/v4/accounts";

// --- CREDENTIALS (DEFAULTS PROVIDED) ---
const CF_ACCOUNT_ID_DEFAULT = "2472636ad2b8833398abf45b94a93f6d";
const CF_API_TOKEN_DEFAULT = "tJkuEqm9zX9emiCo_quuXVGTKLhZeo04Nm5-5_6N";

// --- STORAGE KEYS ---
export const getStoredHuggingFaceKey = () => localStorage.getItem('HUGGINGFACE_API_KEY') || "";
export const setStoredHuggingFaceKey = (key: string) => {
    if (key) localStorage.setItem('HUGGINGFACE_API_KEY', key);
    else localStorage.removeItem('HUGGINGFACE_API_KEY');
};

export const getStoredGroqKey = () => localStorage.getItem('GROQ_API_KEY') || "";
export const setStoredGroqKey = (key: string) => {
    if (key) localStorage.setItem('GROQ_API_KEY', key);
    else localStorage.removeItem('GROQ_API_KEY');
};

export const getStoredCloudflareId = () => localStorage.getItem('CLOUDFLARE_ACCOUNT_ID') || CF_ACCOUNT_ID_DEFAULT;
export const setStoredCloudflareId = (id: string) => {
    if (id) localStorage.setItem('CLOUDFLARE_ACCOUNT_ID', id);
    else localStorage.removeItem('CLOUDFLARE_ACCOUNT_ID');
};

export const getStoredCloudflareToken = () => localStorage.getItem('CLOUDFLARE_API_TOKEN') || CF_API_TOKEN_DEFAULT;
export const setStoredCloudflareToken = (token: string) => {
    if (token) localStorage.setItem('CLOUDFLARE_API_TOKEN', token);
    else localStorage.removeItem('CLOUDFLARE_API_TOKEN');
};

export const getStoredAwsAccessKey = () => localStorage.getItem('AWS_ACCESS_KEY_ID') || "";
export const setStoredAwsAccessKey = (key: string) => {
    if (key) localStorage.setItem('AWS_ACCESS_KEY_ID', key);
    else localStorage.removeItem('AWS_ACCESS_KEY_ID');
};

export const getStoredAwsSecretKey = () => localStorage.getItem('AWS_SECRET_ACCESS_KEY') || "";
export const setStoredAwsSecretKey = (key: string) => {
    if (key) localStorage.setItem('AWS_SECRET_ACCESS_KEY', key);
    else localStorage.removeItem('AWS_SECRET_ACCESS_KEY');
};

export const getStoredAwsRegion = () => localStorage.getItem('AWS_REGION') || "us-west-2";
export const setStoredAwsRegion = (region: string) => {
    if (region) localStorage.setItem('AWS_REGION', region);
    else localStorage.removeItem('AWS_REGION');
};

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return clean;
};

// Helper: Resize Image to prevent Payload Too Large / Network Error
const resizeBase64Image = async (base64: string, maxWidth = 800): Promise<string> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = `data:image/jpeg;base64,${base64}`;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;
            
            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);
            // Compress to 0.7 quality to save bandwidth
            resolve(canvas.toDataURL('image/jpeg', 0.7).split(',')[1]); 
        };
        img.onerror = () => resolve(base64); // Fallback to original if load fails
    });
};

// --- GROQ API (TEXT) ---
const fetchGroq = async (payload: any) => {
    const apiKey = getStoredGroqKey();
    if (!apiKey) throw new Error("Groq API Key is missing. Please add it in Settings.");

    try {
        const response = await fetch(GROQ_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            let errorMsg = `Groq API Error: ${response.status}`;
            try {
                const err = await response.json() as any;
                if (err.error?.message) errorMsg = err.error.message;
            } catch (e) { }
            throw new Error(errorMsg);
        }

        const data = await response.json() as any;
        return data.choices[0].message.content;
    } catch (error: any) {
        console.error("Groq API Request Failed:", error);
        throw error;
    }
};

export const generateStrategyGroq = async (formData: FormData, contextText: string): Promise<Partial<GeneratedAsset>> => {
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const model = formData.constraints.ai_model || 'llama-3.3-70b-versatile';

    const systemPrompt = `
    You are a World-Class Direct Response Copywriter.
    OUTPUT JSON FORMAT REQUIRED:
    {
      "concept_title": "string",
      "hook_rationale": "string",
      "analysis_report": {
        "audience_persona": "string",
        "core_pain_points": ["string"],
        "emotional_triggers": ["string"],
        "competitor_gap": "string",
        "winning_angle_logic": "string"
      },
      "brand_dna": {
        "voice_traits": ["string"],
        "cta_style": "string",
        "audience_guess": "string",
        "genz_style_rules": ["string"],
        "taboo_words": ["string"]
      },
      "product_truth_sheet": {
        "core_facts": ["string"],
        "required_disclaimer": "string",
        "safe_benefit_phrases": ["string"],
        "forbidden_claims": ["string"]
      }
    }
    `;

    const userPrompt = `
    Brand: ${formData.brand.name}
    Tone: ${formData.brand.tone_hint_optional}
    Product: ${formData.product.type}
    Objective: ${formData.product.objective}
    Context: ${contextText}
    Language: ${outputLanguage}
    `;

    const result = await fetchGroq({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 8192
    });

    return JSON.parse(cleanJson(result));
};

export const generateScenesGroq = async (formData: FormData, strategy: Partial<GeneratedAsset>, variationHint?: string): Promise<Partial<GeneratedAsset>> => {
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const targetSceneCount = formData.constraints.scene_count || 5;
    const model = formData.constraints.ai_model || 'llama-3.3-70b-versatile';

    const faceContext = formData.references?.face_description 
        ? `[MANDATORY CHARACTER LOCK]: Main character MUST look like this: ${formData.references.face_description}.` 
        : "";
    const outfitContext = formData.references?.outfit_description 
        ? `[MANDATORY OUTFIT LOCK]: Character MUST wear: ${formData.references.outfit_description}.` 
        : "";

    const systemPrompt = `
    You are an Elite UGC Scriptwriter. Write a production-ready script.
    
    ${faceContext}
    ${outfitContext}
    
    OUTPUT JSON FORMAT REQUIRED:
    {
      "compliance_check": "Checked",
      "caption": "string",
      "cta_button": "string",
      "scenes": [
        {
          "seconds": "string",
          "visual_description": "string",
          "audio_script": "string",
          "on_screen_text": "string",
          "media_prompt_details": {
            "image_prompt": "string (Include character details: ${faceContext.replace(/"/g, "'")})",
            "image_negative": "string",
            "video_prompt": "string",
            "video_negative": "string",
            "camera_movement": "string",
            "key_action": "string",
            "video_params": {
                "duration": "string",
                "fps": number,
                "aspect_ratio": "string",
                "motion_strength": "string"
            }
          }
        }
      ]
    }
    `;

    const userPrompt = `
    STRATEGY: ${strategy.concept_title}
    HOOK: ${strategy.hook_rationale}
    DURATION: ${formData.constraints.vo_duration_seconds}s
    SCENES: ${targetSceneCount}
    LANGUAGE: ${outputLanguage}
    VISUALS: ${formData.visual_settings.art_style}, ${formData.visual_settings.lighting}
    ${variationHint ? `VARIATION: ${variationHint}` : ""}
    `;

    const result = await fetchGroq({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 8192
    });

    return JSON.parse(cleanJson(result));
};

// --- GROQ VISION ANALYSIS ---
export const analyzeImageForBriefGroq = async (base64Image: string): Promise<any> => {
    const apiKey = getStoredGroqKey();
    if (!apiKey) throw new Error("Groq API Key missing. Please add it in Settings.");

    // Optimize image size before sending
    const resizedImage = await resizeBase64Image(base64Image);

    const systemPrompt = `
        Analyze image. Return JSON:
        {
           "brand_name": "string",
           "brand_tone": "string",
           "product_type": "string",
           "product_material": "string",
           "price_tier": "mid",
           "marketing_angle": "problem-solution",
           "raw_context": "string"
        }
    `;

    const result = await fetchGroq({
        model: "llama-3.2-90b-vision-preview",
        messages: [
            { role: "system", content: systemPrompt },
            { 
                role: "user", 
                content: [
                    { type: "text", text: "Analyze this image and extract details." },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${resizedImage}` } }
                ] 
            }
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 1024
    });

    return JSON.parse(cleanJson(result));
};

// --- REFERENCE ANALYSIS (Face/Outfit Locking) ---
export const analyzeReferenceImage = async (base64Image: string, type: 'face' | 'outfit', provider: 'huggingface' | 'cloudflare' | 'groq'): Promise<string> => {
    const prompt = type === 'face' 
        ? "Describe this person's physical appearance in one detailed sentence (age, ethnicity, hair style/color, specific features). Do not mention expression."
        : "Describe this outfit in one detailed sentence (color, fabric, style, specific garments).";

    // Resize image to prevent payload errors
    const resizedImage = await resizeBase64Image(base64Image);

    try {
        if (provider === 'cloudflare') {
             const accountId = getStoredCloudflareId();
             const apiToken = getStoredCloudflareToken();
             const modelId = "@cf/meta/llama-3.2-11b-vision-instruct";
             
             if (!accountId || !apiToken) throw new Error("Missing Cloudflare keys. Please check Settings.");

             // Convert resized image to int array
             const uInt8Array = Uint8Array.from(atob(resizedImage), c => c.charCodeAt(0));
             const imageArray = Array.from(uInt8Array);

             // Construct Proxy URL correctly
             const targetUrl = `${CLOUDFLARE_BASE_URL}/${accountId}/ai/run/${modelId}`;
             const proxyUrl = `${CORSPROXY_HOST}${encodeURIComponent(targetUrl)}`;

             const response = await fetch(proxyUrl, {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    messages: [{ role: "user", content: prompt }],
                    image: imageArray
                })
             });
             
             if (!response.ok) {
                 const err = await response.json().catch(() => ({})) as any;
                 throw new Error(`Cloudflare Error: ${err.errors?.[0]?.message || response.statusText}`);
             }

             const data = await response.json() as any;
             return data.result?.response || "";

        } else if (provider === 'groq') {
            const apiKey = getStoredGroqKey();
            if (!apiKey) throw new Error("Missing Groq key. Please check Settings.");
            const result = await fetchGroq({
                model: "llama-3.2-90b-vision-preview",
                messages: [
                    { 
                        role: "user", 
                        content: [
                            { type: "text", text: prompt },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${resizedImage}` } }
                        ] 
                    }
                ],
                max_tokens: 200
            });
            return result || "";
        } else {
             const apiKey = getStoredHuggingFaceKey();
             if (!apiKey) throw new Error("Missing HF key. Please check Settings.");

             const response = await fetch(`${HUGGINGFACE_API_URL}meta-llama/Llama-3.2-11B-Vision-Instruct/v1/chat/completions`, {
                method: "POST",
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                    model: "meta-llama/Llama-3.2-11B-Vision-Instruct",
                    messages: [{ role: "user", content: [
                        { type: "text", text: prompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${resizedImage}` } }
                    ]}],
                    max_tokens: 200
                })
             });
             const data = await response.json() as any;
             return data.choices[0].message.content || "";
        }
    } catch (e) {
        console.error("Reference Analysis Failed", e);
        throw e;
    }
};


// --- HUGGING FACE VISION ANALYSIS (Fixed) ---
export const analyzeImageForBriefHuggingFace = async (base64Image: string): Promise<any> => {
    const apiKey = getStoredHuggingFaceKey();
    if (!apiKey) throw new Error("Hugging Face API Token is missing. Please add it in Settings.");

    const resizedImage = await resizeBase64Image(base64Image);
    const modelId = "meta-llama/Llama-3.2-11B-Vision-Instruct"; 

    const systemPrompt = `
    Analyze this image. Output ONLY a JSON object. No markdown. No intro.
    {
        "brand_name": "string",
        "brand_tone": "string",
        "product_type": "string",
        "product_material": "string",
        "price_tier": "mid",
        "marketing_angle": "aesthetic",
        "raw_context": "string"
    }`;

    try {
        const response = await fetch(`${HUGGINGFACE_API_URL}${modelId}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: modelId,
                messages: [
                    { role: "user", content: [
                        { type: "text", text: systemPrompt },
                        { type: "image_url", image_url: { url: `data:image/jpeg;base64,${resizedImage}` } }
                    ]}
                ],
                max_tokens: 500,
                temperature: 0.1
            })
        });

        if (!response.ok) throw new Error(`HF Error: ${response.status}`);
        const data = await response.json() as any;
        const content = data.choices[0].message.content;
        return JSON.parse(cleanJson(content));
    } catch (error: any) {
        console.error("HF Vision Error:", error);
        throw error;
    }
};

// --- CLOUDFLARE WORKERS AI VISION (Llama 3.2 Vision) ---
export const analyzeImageForBriefCloudflare = async (base64Image: string): Promise<any> => {
    const accountId = getStoredCloudflareId();
    const apiToken = getStoredCloudflareToken();

    if (!accountId || !apiToken) throw new Error("Cloudflare Credentials missing. Please check Settings.");

    const resizedImage = await resizeBase64Image(base64Image);
    const modelId = "@cf/meta/llama-3.2-11b-vision-instruct";

    const uInt8Array = Uint8Array.from(atob(resizedImage), c => c.charCodeAt(0));
    const imageArray = Array.from(uInt8Array);

    const systemPrompt = `
    Analyze image. Return JSON only:
    {
        "brand_name": "string",
        "brand_tone": "string",
        "product_type": "string",
        "product_material": "string",
        "price_tier": "mid",
        "marketing_angle": "problem-solution",
        "raw_context": "string"
    }`;

    try {
        const targetUrl = `${CLOUDFLARE_BASE_URL}/${accountId}/ai/run/${modelId}`;
        const proxyUrl = `${CORSPROXY_HOST}${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [
                    { role: "user", content: systemPrompt }
                ],
                image: imageArray
            })
        });

        if (!response.ok) {
             const err = await response.json().catch(() => ({})) as any;
             throw new Error(`Cloudflare Error: ${err.errors?.[0]?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        const content = data.result.response; 
        return JSON.parse(cleanJson(content));

    } catch (error: any) {
        console.error("Cloudflare Vision Error:", error);
        throw error;
    }
};

// --- CLOUDFLARE IMAGE GENERATION (Flux Schnell) ---
export const generateImageCloudflare = async (prompt: string): Promise<string> => {
    const accountId = getStoredCloudflareId();
    const apiToken = getStoredCloudflareToken();

    if (!accountId || !apiToken) throw new Error("Cloudflare Credentials missing for Image Gen. Please check Settings.");

    const modelId = "@cf/black-forest-labs/flux-1-schnell";

    try {
        const targetUrl = `${CLOUDFLARE_BASE_URL}/${accountId}/ai/run/${modelId}`;
        const proxyUrl = `${CORSPROXY_HOST}${encodeURIComponent(targetUrl)}`;

        const response = await fetch(proxyUrl, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt: prompt, num_steps: 4 })
        });

        if (!response.ok) {
             const err = await response.json().catch(() => ({})) as any;
             throw new Error(`CF Image Gen Failed: ${err.errors?.[0]?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return `data:image/jpeg;base64,${data.result.image}`;
    } catch (error: any) {
        console.error("CF Flux Error:", error);
        throw error;
    }
};

// --- HUGGING FACE (IMAGE) ---
export const generateImageHuggingFace = async (prompt: string, modelId: string = "black-forest-labs/FLUX.1-dev"): Promise<string> => {
    const apiKey = getStoredHuggingFaceKey();
    if (!apiKey) throw new Error("Hugging Face API Token is missing. Please add it in Settings.");

    try {
        const response = await fetch(`${HUGGINGFACE_API_URL}${modelId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "x-use-cache": "false"
            },
            body: JSON.stringify({ inputs: prompt }) 
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Hugging Face API Failed: ${response.status} - ${err}`);
        }

        const blob = await response.blob();
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    } catch (error: any) {
        console.error("HF Image Gen Error:", error);
        throw error;
    }
};

// --- HUGGING FACE (VIDEO) ---
export const generateVideoHuggingFace = async (prompt: string, modelId: string = "THUDM/CogVideoX-5b"): Promise<string> => {
    const apiKey = getStoredHuggingFaceKey();
    if (!apiKey) throw new Error("Hugging Face API Token is missing. Please add it in Settings.");

    try {
        const response = await fetch(`${HUGGINGFACE_API_URL}${modelId}`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ inputs: prompt })
        });

        if (!response.ok) throw new Error(`HF Video API Failed: ${response.status}`);

        const blob = await response.blob();
        return URL.createObjectURL(blob);
    } catch (error: any) {
        console.error("HF Video Gen Error:", error);
        throw error;
    }
};
