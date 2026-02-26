
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

export const getStoredXaiKey = () => localStorage.getItem('XAI_API_KEY') || "";
export const setStoredXaiKey = (key: string) => {
    if (key) localStorage.setItem('XAI_API_KEY', key);
    else localStorage.removeItem('XAI_API_KEY');
};

const cleanJson = (text: string): string => {
  if (!text) return "{}";
  // Try to find JSON object
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  
  if (start !== -1 && end !== -1) {
      return text.substring(start, end + 1);
  }
  
  // Fallback cleanup
  let clean = text.trim();
  clean = clean.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
  return clean;
};

// --- UTILS ---
const FETCH_TIMEOUT = 60000; // 60 seconds

export const fetchWithTimeout = async (url: string, options: any = {}) => {
    const { timeout = FETCH_TIMEOUT } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    
    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal
        });
        clearTimeout(id);
        return response;
    } catch (error: any) {
        clearTimeout(id);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout/1000}s. The AI service might be overloaded.`);
        }
        throw error;
    }
};

// Helper: Resize Image to prevent Payload Too Large / Network Error
export const resizeBase64Image = async (base64: string, maxWidth = 800): Promise<string> => {
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

// --- XAI (GROK) API ---
const XAI_API_URL = "https://api.x.ai/v1/chat/completions";

const fetchXai = async (payload: any) => {
    const apiKey = getStoredXaiKey();
    if (!apiKey) throw new Error("xAI API Key is missing. Please add it in Settings.");

    try {
        const response = await fetchWithTimeout(XAI_API_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({})) as any;
            console.error("xAI Full Error Response:", err);
            throw new Error(`xAI Error: ${err.error?.message || JSON.stringify(err) || response.statusText}`);
        }

        const data = await response.json() as any;
        return data.choices[0].message.content;
    } catch (error: any) {
        console.error("xAI Request Failed:", error);
        throw error;
    }
};

export const generateStrategyXai = async (formData: FormData, contextText: string): Promise<Partial<GeneratedAsset>> => {
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const model = formData.constraints.ai_model || 'grok-3';

        const systemPrompt = `
    You are an Elite TikTok/Reels Creative Director & Direct-Response Copywriter.
    Your goal is to engineer viral, high-converting UGC (User Generated Content) concepts.
    
    RULES FOR STRATEGY:
    1. AVOID CLICHES: Never use generic openings like "Are you tired of...". Use Pattern Interrupts (Visual hooks, bold statements, contrarian opinions, or ASMR/sensory triggers).
    2. PSYCHOLOGY: Base the angle on deep psychological triggers (Status, FOMO, Laziness, Insecurity, or Desire for Aesthetic).
    3. GEN-Z/MILLENNIAL TONE: Keep the tone authentic, conversational, and native to short-form platforms.
    
    OUTPUT EXACTLY IN THIS JSON FORMAT:
    {
      "concept_title": "string (Catchy, internal agency name for this concept)",
      "hook_rationale": "string (Why will this stop a user from scrolling within the first 3 seconds?)",
      "analysis_report": {
        "audience_persona": "string (Ultra-specific target, e.g., 'Burnt-out corporate girlies in their 20s')",
        "core_pain_points": ["string", "string"],
        "emotional_triggers": ["string"],
        "competitor_gap": "string (What are competitors ignoring that we will highlight?)",
        "winning_angle_logic": "string (The psychological framework used, e.g., PAS, Us-vs-Them, or Secret Hack)"
      },
      "brand_dna": {
        "voice_traits": ["string", "string", "string"],
        "cta_style": "string (How to ask for the sale naturally)",
        "audience_guess": "string",
        "genz_style_rules": ["string (e.g., 'Don't sound like a TV commercial')"],
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
    BRAND INFO:
    - Name: ${formData.brand.name}
    - Requested Tone: ${formData.brand.tone_hint_optional || 'Native UGC, Authentic, Engaging'}
    
    PRODUCT INFO:
    - Type/Item: ${formData.product.type}
    - Key Feature: ${formData.product.material}
    - Marketing Objective: ${formData.product.objective}
    - Requested Angle: ${formData.product.main_angle_optional}
    
    CONTEXT / SCRAPED DATA:
    ${contextText}
    
    TARGET SETTINGS:
    - Language: ${formData.constraints.language === 'en' ? 'English' : 'Indonesian (Use native, natural slang. If ID, use Jaksel or casual conversational style depending on the product).'}
    - Market Nuances: ${formData.constraints.indonesian_nuances || 'None specified'}
    
    Task: Analyze the inputs and generate the underlying viral strategy json.
    `;


    const result = await fetchXai({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
    });

    return JSON.parse(cleanJson(result));
};

export const generateScenesXai = async (formData: FormData, strategy: Partial<GeneratedAsset>, variationHint?: string): Promise<Partial<GeneratedAsset>> => {
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const targetSceneCount = formData.constraints.scene_count || 5;
    const model = formData.constraints.ai_model || 'grok-3';

        const faceContext = formData.references?.face_description 
        ? `[MANDATORY CHARACTER LOCK]: Main character MUST look exactly like this: ${formData.references.face_description}. Include this description in EVERY media prompt.` 
        : "";
    const outfitContext = formData.references?.outfit_description 
        ? `[MANDATORY OUTFIT LOCK]: Character MUST wear: ${formData.references.outfit_description}. Include this in EVERY media prompt.` 
        : "";

    const systemPrompt = `
    You are an Elite UGC Scriptwriter & Expert AI Cinematographer.
    Your job is to translate a viral strategy into a frame-by-frame production script.

    STRICT PACING RULES:
    - TikTok/Reels move FAST. Keep scenes between 2 to 6 seconds max.
    - SCENE 1 MUST be a 3-second visual and auditory Pattern Interrupt (The Hook).
    - Show, Don't Tell: If the voiceover says "it's waterproof", the visual MUST be splashing water on the product.

    PROMPT ENGINEERING RULES (CRITICAL FOR AI IMAGE/VIDEO GENERATION):
    - "image_prompt": Must use photography terms. Start with "Raw smartphone photo, UGC style..." or "Cinematic 35mm lens...". Describe lighting, subject, action, and background explicitly. No abstract concepts.
    - "video_prompt": Describe motion. e.g., "Handheld camera slowly zooming in on [subject] doing [action], natural window lighting, 4k resolution, highly detailed."
    - DO NOT use text/words inside image_prompt or video_prompt. AI models struggle with text rendering.

    ${faceContext}
    ${outfitContext}

    OUTPUT EXACTLY IN THIS JSON FORMAT:
    {
      "compliance_check": "Checked",
      "caption": "string (Viral social media caption with emojis and hashtags)",
      "cta_button": "string (Short text for the ad button, e.g., 'Shop Now')",
      "scenes": [
        {
          "seconds": "string (e.g., '3')",
          "visual_description": "string (What the human director needs to know. e.g., 'Close up shot of hands applying serum')",
          "audio_script": "string (The EXACT spoken voiceover. Keep it punchy)",
          "on_screen_text": "string (Text overlay popping up on screen. Max 5 words)",
          "media_prompt_details": {
            "image_prompt": "string (Highly detailed prompt for FLUX/Midjourney)",
            "image_negative": "text, watermark, ugly, cartoon, illustration",
            "video_prompt": "string (Highly detailed prompt for Veo/Sora/CogVideo focusing on motion)",
            "video_negative": "text, watermark, morphing, blurry",
            "camera_movement": "string (e.g., 'Static tripod', 'Handheld shaky', 'Smooth pan right')",
            "key_action": "string",
            "video_params": {
                "duration": "string",
                "fps": 30,
                "aspect_ratio": "9:16",
                "motion_strength": "5"
            }
          }
        }
      ]
    }
    `;

    const userPrompt = `
    STRATEGY TO EXECUTE:
    - Concept: ${strategy.concept_title}
    - Hook Rationale: ${strategy.hook_rationale}
    - Winning Angle: ${strategy.analysis_report?.winning_angle_logic}

    CONSTRAINTS:
    - Total Target Duration: ${formData.constraints.vo_duration_seconds} seconds
    - Target Scene Count: ${targetSceneCount} scenes
    - Language: ${formData.constraints.language === 'en' ? 'English' : 'Indonesian (Gunakan bahasa gaul/slang sosmed yang sangat natural)'}
    
    VISUAL DIRECTION:
    - Art Style: ${formData.visual_settings.art_style}
    - Lighting: ${formData.visual_settings.lighting}
    - Camera Angle: ${formData.visual_settings.camera_angle}
    - Pacing: ${formData.visual_settings.pacing}
    
    ${variationHint ? `\nCRITICAL VARIATION INSTRUCTION:\n${variationHint}` : ""}
    
    Write the scenes now. Ensure the sum of 'seconds' roughly equals the Target Duration.
    `;


    const result = await fetchXai({
        model: model,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 4096
    });

    return JSON.parse(cleanJson(result));
};

export const analyzeImageForBriefXai = async (base64Image: string): Promise<any> => {
    const resizedImage = await resizeBase64Image(base64Image);
    const modelId = "grok-3-vision";

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

    const result = await fetchXai({
        model: modelId,
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
        temperature: 0.3,
        max_tokens: 1024
    });

    return JSON.parse(cleanJson(result));
};

export const analyzeReferenceImageXai = async (base64Image: string, type: 'face' | 'outfit'): Promise<string> => {
    const prompt = type === 'face' 
        ? "Describe this person's physical appearance in one detailed sentence (age, ethnicity, hair style/color, specific features). Do not mention expression."
        : "Describe this outfit in one detailed sentence (color, fabric, style, specific garments).";

    const resizedImage = await resizeBase64Image(base64Image);
    const modelId = "grok-3-vision";

    const result = await fetchXai({
        model: modelId,
        messages: [
            { 
                role: "user", 
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${resizedImage}` } }
                ] 
            }
        ],
        max_tokens: 300
    });

    return result || "";
};

// --- XAI (GROK) IMAGE GENERATION ---
export const generateImageXai = async (prompt: string): Promise<string> => {
    const apiKey = getStoredXaiKey();
    if (!apiKey) throw new Error("xAI API Key is missing. Please add it in Settings.");

    // xAI is OpenAI compatible. Assuming standard endpoint.
    // If this fails, it means xAI hasn't enabled public API for images yet.
    const XAI_IMAGE_URL = "https://api.x.ai/v1/images/generations"; 
    
    try {
        const response = await fetchWithTimeout(XAI_IMAGE_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                prompt: prompt,
                model: "grok-2-vision-1212", 
                n: 1,
                size: "1024x1024",
                response_format: "b64_json"
            })
        });

        if (!response.ok) {
             const err = await response.json().catch(() => ({})) as any;
             throw new Error(`xAI Image Gen Error: ${err.error?.message || response.statusText}`);
        }

        const data = await response.json() as any;
        return `data:image/jpeg;base64,${data.data[0].b64_json}`;
    } catch (error: any) {
        console.error("xAI Image Gen Failed:", error);
        throw error;
    }
};

// --- GROQ API (TEXT) ---
const fetchGroq = async (payload: any) => {
    const apiKey = getStoredGroqKey();
    if (!apiKey) throw new Error("Groq API Key is missing. Please add it in Settings.");

    try {
        const response = await fetchWithTimeout(GROQ_API_URL, {
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
    You are an Elite TikTok/Reels Creative Director & Direct-Response Copywriter.
    Your goal is to engineer viral, high-converting UGC (User Generated Content) concepts.
    
    RULES FOR STRATEGY:
    1. AVOID CLICHES: Never use generic openings like "Are you tired of...". Use Pattern Interrupts (Visual hooks, bold statements, contrarian opinions, or ASMR/sensory triggers).
    2. PSYCHOLOGY: Base the angle on deep psychological triggers (Status, FOMO, Laziness, Insecurity, or Desire for Aesthetic).
    3. GEN-Z/MILLENNIAL TONE: Keep the tone authentic, conversational, and native to short-form platforms.
    
    OUTPUT EXACTLY IN THIS JSON FORMAT:
    {
      "concept_title": "string (Catchy, internal agency name for this concept)",
      "hook_rationale": "string (Why will this stop a user from scrolling within the first 3 seconds?)",
      "analysis_report": {
        "audience_persona": "string (Ultra-specific target, e.g., 'Burnt-out corporate girlies in their 20s')",
        "core_pain_points": ["string", "string"],
        "emotional_triggers": ["string"],
        "competitor_gap": "string (What are competitors ignoring that we will highlight?)",
        "winning_angle_logic": "string (The psychological framework used, e.g., PAS, Us-vs-Them, or Secret Hack)"
      },
      "brand_dna": {
        "voice_traits": ["string", "string", "string"],
        "cta_style": "string (How to ask for the sale naturally)",
        "audience_guess": "string",
        "genz_style_rules": ["string (e.g., 'Don't sound like a TV commercial')"],
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
    BRAND INFO:
    - Name: ${formData.brand.name}
    - Requested Tone: ${formData.brand.tone_hint_optional || 'Native UGC, Authentic, Engaging'}
    
    PRODUCT INFO:
    - Type/Item: ${formData.product.type}
    - Key Feature: ${formData.product.material}
    - Marketing Objective: ${formData.product.objective}
    - Requested Angle: ${formData.product.main_angle_optional}
    
    CONTEXT / SCRAPED DATA:
    ${contextText}
    
    TARGET SETTINGS:
    - Language: ${formData.constraints.language === 'en' ? 'English' : 'Indonesian (Use native, natural slang. If ID, use Jaksel or casual conversational style depending on the product).'}
    - Market Nuances: ${formData.constraints.indonesian_nuances || 'None specified'}
    
    Task: Analyze the inputs and generate the underlying viral strategy json.
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
        ? `[MANDATORY CHARACTER LOCK]: Main character MUST look exactly like this: ${formData.references.face_description}. Include this description in EVERY media prompt.` 
        : "";
    const outfitContext = formData.references?.outfit_description 
        ? `[MANDATORY OUTFIT LOCK]: Character MUST wear: ${formData.references.outfit_description}. Include this in EVERY media prompt.` 
        : "";

    const systemPrompt = `
    You are an Elite UGC Scriptwriter & Expert AI Cinematographer.
    Your job is to translate a viral strategy into a frame-by-frame production script.

    STRICT PACING RULES:
    - TikTok/Reels move FAST. Keep scenes between 2 to 6 seconds max.
    - SCENE 1 MUST be a 3-second visual and auditory Pattern Interrupt (The Hook).
    - Show, Don't Tell: If the voiceover says "it's waterproof", the visual MUST be splashing water on the product.

    PROMPT ENGINEERING RULES (CRITICAL FOR AI IMAGE/VIDEO GENERATION):
    - "image_prompt": Must use photography terms. Start with "Raw smartphone photo, UGC style..." or "Cinematic 35mm lens...". Describe lighting, subject, action, and background explicitly. No abstract concepts.
    - "video_prompt": Describe motion. e.g., "Handheld camera slowly zooming in on [subject] doing [action], natural window lighting, 4k resolution, highly detailed."
    - DO NOT use text/words inside image_prompt or video_prompt. AI models struggle with text rendering.

    ${faceContext}
    ${outfitContext}

    OUTPUT EXACTLY IN THIS JSON FORMAT:
    {
      "compliance_check": "Checked",
      "caption": "string (Viral social media caption with emojis and hashtags)",
      "cta_button": "string (Short text for the ad button, e.g., 'Shop Now')",
      "scenes": [
        {
          "seconds": "string (e.g., '3')",
          "visual_description": "string (What the human director needs to know. e.g., 'Close up shot of hands applying serum')",
          "audio_script": "string (The EXACT spoken voiceover. Keep it punchy)",
          "on_screen_text": "string (Text overlay popping up on screen. Max 5 words)",
          "media_prompt_details": {
            "image_prompt": "string (Highly detailed prompt for FLUX/Midjourney)",
            "image_negative": "text, watermark, ugly, cartoon, illustration",
            "video_prompt": "string (Highly detailed prompt for Veo/Sora/CogVideo focusing on motion)",
            "video_negative": "text, watermark, morphing, blurry",
            "camera_movement": "string (e.g., 'Static tripod', 'Handheld shaky', 'Smooth pan right')",
            "key_action": "string",
            "video_params": {
                "duration": "string",
                "fps": 30,
                "aspect_ratio": "9:16",
                "motion_strength": "5"
            }
          }
        }
      ]
    }
    `;

    const userPrompt = `
    STRATEGY TO EXECUTE:
    - Concept: ${strategy.concept_title}
    - Hook Rationale: ${strategy.hook_rationale}
    - Winning Angle: ${strategy.analysis_report?.winning_angle_logic}

    CONSTRAINTS:
    - Total Target Duration: ${formData.constraints.vo_duration_seconds} seconds
    - Target Scene Count: ${targetSceneCount} scenes
    - Language: ${formData.constraints.language === 'en' ? 'English' : 'Indonesian (Gunakan bahasa gaul/slang sosmed yang sangat natural)'}
    
    VISUAL DIRECTION:
    - Art Style: ${formData.visual_settings.art_style}
    - Lighting: ${formData.visual_settings.lighting}
    - Camera Angle: ${formData.visual_settings.camera_angle}
    - Pacing: ${formData.visual_settings.pacing}
    
    ${variationHint ? `\nCRITICAL VARIATION INSTRUCTION:\n${variationHint}` : ""}
    
    Write the scenes now. Ensure the sum of 'seconds' roughly equals the Target Duration.
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

             const response = await fetchWithTimeout(proxyUrl, {
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
        const response = await fetchWithTimeout(`${HUGGINGFACE_API_URL}${modelId}/v1/chat/completions`, {
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

        const response = await fetchWithTimeout(proxyUrl, {
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

// --- CLOUDFLARE IMAGE GENERATION ---
export const generateImageCloudflare = async (prompt: string, modelId: string = "@cf/black-forest-labs/flux-1-schnell"): Promise<string> => {
    const accountId = getStoredCloudflareId();
    const apiToken = getStoredCloudflareToken();
    if (!accountId || !apiToken) throw new Error("Cloudflare Credentials missing.");

    const targetUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;

    try {
        const response = await fetchWithTimeout('/api/proxy', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider: "Cloudflare",
                url: targetUrl,
                headers: { "Authorization": `Bearer ${apiToken}`, "Content-Type": "application/json" },
                payload: { prompt: prompt }, // 🔥 FIX 1: Hapus num_steps
                isBlob: true // 🔥 FIX 2: Ubah jadi TRUE karena CF mengembalikan file mentah
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`CF Proxy Error: ${errData.error || response.statusText}`);
        }
        
        const data = await response.json() as any;
        return `data:image/jpeg;base64,${data.base64}`; // 🔥 FIX 3: Ambil dari base64
    } catch (error) {
        console.error("CF Flux Error:", error);
        throw error;
    }
};

// --- HUGGING FACE IMAGE GENERATION ---
export const generateImageHuggingFace = async (prompt: string, modelId: string = "black-forest-labs/FLUX.1-dev"): Promise<string> => {
    const apiKey = getStoredHuggingFaceKey();
    if (!apiKey) throw new Error("Hugging Face API Token missing.");

    try {
        const response = await fetchWithTimeout('/api/proxy', {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                provider: "HuggingFace",
                url: `https://router.huggingface.co/models/${modelId}`,
                headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
                payload: { inputs: prompt },
                isBlob: true 
            })
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(`HF Proxy Error: ${errData.error || response.statusText}`);
        }

        const data = await response.json() as any;
        return `data:image/jpeg;base64,${data.base64}`;
    } catch (error) {
        console.error("HF Image Error:", error);
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
