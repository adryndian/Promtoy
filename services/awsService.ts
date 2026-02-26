import { getStoredAwsAccessKey, getStoredAwsSecretKey, getStoredAwsRegion, fetchWithTimeout } from './externalService';
import { FormData, GeneratedAsset } from "../types";

const AWS_PROXY_URL = '/api/aws/bedrock';

export const analyzeImageBedrock = async (base64Image: string, mimeType: string = "image/jpeg", _modelId: string = "us.anthropic.claude-sonnet-4-6"): Promise<any> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    const modelId = "us.anthropic.claude-sonnet-4-6"; // Claude 4.6 Sonnet (Forced as per fix)

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS Credentials missing. Please check Settings.");
    }

    const systemPrompt = `
    Analyze this image for a marketing brief. Return ONLY a valid JSON object with this structure:
    {
        "brand_name": "string",
        "brand_tone": "string",
        "product_type": "string",
        "product_material": "string",
        "price_tier": "mid",
        "marketing_angle": "problem-solution",
        "raw_context": "string"
    }
    Do not include markdown formatting like \`\`\`json. Just the raw JSON.
    `;

    const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: mimeType,
                            data: base64Image
                        }
                    },
                    {
                        type: "text",
                        text: "Analyze this image and extract the brand details."
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetchWithTimeout(AWS_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                modelId,
                body
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Bedrock Analysis Failed');
        }

        const data = await response.json() as any;
        // Claude 3 response format
        const contentText = data.content[0].text;
        
        // Robust JSON Extraction
        const start = contentText.indexOf('{');
        const end = contentText.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
            const jsonStr = contentText.substring(start, end + 1);
            return JSON.parse(jsonStr);
        }
        
        // Fallback cleanup
        const cleanJson = contentText.replace(/```json\s*|\s*```/g, '').trim();
        return JSON.parse(cleanJson);

    } catch (error) {
        console.error("AWS Bedrock Analysis Error:", error);
        throw error;
    }
};

// --- IMAGE GENERATION ---

export const generateImageBedrock = async (prompt: string, modelId: string = "amazon.titan-image-generator-v2:0"): Promise<string> => {
  const accessKeyId = getStoredAwsAccessKey().trim();
  const secretAccessKey = getStoredAwsSecretKey().trim();
  const region = getStoredAwsRegion().trim();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("AWS Credentials missing. Please check Settings.");
  }

  let body: any = {};

  // Construct payload based on model
  if (modelId.startsWith("amazon.titan")) {
      body = {
        taskType: "TEXT_IMAGE",
        textToImageParams: {
          text: prompt,
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: 1024,
          width: 1024,
          cfgScale: 8.0,
          seed: Math.floor(Math.random() * 2147483647),
        },
      };
  } else {
      throw new Error(`Unsupported AWS Bedrock Image Model: ${modelId}`);
  }

  try {
    const response = await fetchWithTimeout(AWS_PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        region,
        accessKeyId,
        secretAccessKey,
        modelId,
        body
      })
    });

    if (!response.ok) {
        const err = await response.json() as any;
        throw new Error(err.error || 'AWS Bedrock Request Failed');
    }

    const data = await response.json() as any;
    
    // Handle different response formats
    if (modelId.startsWith("amazon.titan")) {
        return `data:image/png;base64,${data.images[0]}`;
    }
    
    throw new Error("Unknown response format from AWS Bedrock");

  } catch (error) {
    console.error("AWS Bedrock Image Gen Error:", error);
    throw error;
  }
};

// --- TEXT TO SPEECH (TITAN/POLLY/NOVA) ---

export const generateSpeechBedrock = async (text: string, voiceId: string = "Joanna", options: { speed?: string } = {}): Promise<string> => {
    // Check if voiceId is a Nova voice
    if (voiceId.startsWith("nova-")) {
        return generateSpeechNova(text, voiceId, options);
    }
    
    return generateSpeechPolly(text, voiceId, options);
};

const generateSpeechNova = async (text: string, voicePreset: string, options: { speed?: string } = {}): Promise<string> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    const modelId = "amazon.nova-sonic-v1:0"; 

    // Nova Sonic speed control might be different or not fully supported in this simple proxy yet.
    // We will pass the text as is for now, or investigate specific params.
    // Current docs suggest 'speechGenerationConfig' might have more options.
    
    try {
        const requestBody: any = {
            textToSpeechParams: {
                text: text
            },
            speechGenerationConfig: {
                numberOfSpeechSegments: 1
            }
        };

        if (options.speed) {
            requestBody.speechGenerationConfig.speed = parseFloat(options.speed);
        }

        const response = await fetchWithTimeout(AWS_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                modelId,
                body: requestBody
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Nova Sonic Request Failed');
        }

        const data = await response.json() as any;
        return `data:audio/mp3;base64,${data.audioContent || data.images?.[0]}`; 
    } catch (error) {
        console.error("AWS Nova Sonic Error:", error);
        throw error;
    }
};

const generateSpeechPolly = async (text: string, voiceId: string, options: { speed?: string } = {}): Promise<string> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();

    const POLLY_PROXY_URL = '/api/aws/polly';

    // Construct SSML if options are present
    let textType = "text";
    let textToSynthesize = text;

    if (options.speed && options.speed !== "1.0") {
        textType = "ssml";
        // Map speed string (e.g. "0.8", "1.2") to SSML rate
        // Polly supports percentages "80%", "120%" or x-slow, slow, medium, fast, x-fast
        // We'll use percentages for granular control
        const ratePct = Math.round(parseFloat(options.speed) * 100);
        textToSynthesize = `<speak><prosody rate="${ratePct}%">${text}</prosody></speak>`;
    }

    try {
        const response = await fetchWithTimeout(POLLY_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                text: textToSynthesize,
                voiceId,
                engine: "neural",
                textType: textType
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Polly Request Failed');
        }

        const data = await response.json() as any;
        return `data:audio/mp3;base64,${data.audioContent}`;
    } catch (error) {
        console.error("AWS Polly TTS Error:", error);
        throw error;
    }
}

// --- STRATEGY & SCENES (LLM) ---

export const generateStrategyBedrock = async (formData: FormData, contextText: string, modelId: string = "us.meta.llama4-maverick-17b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();

    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    
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



    // Construct Body based on Model Family
    let body: any = {};
    
    if (modelId.includes("meta.llama")) {
        body = {
            prompt: `
<|begin_of_text|><|start_header_id|>system<|end_header_id|>
${systemPrompt}
<|eot_id|><|start_header_id|>user<|end_header_id|>
${userPrompt}
<|eot_id|><|start_header_id|>assistant<|end_header_id|>
`,
            max_gen_len: 4096,
            temperature: 0.7,
            top_p: 0.9
        };
    } else if (modelId.includes("amazon.nova")) {
         body = {
             system: [{ text: systemPrompt }],
             messages: [{ role: "user", content: [{ text: userPrompt }] }],
             inferenceConfig: { max_new_tokens: 2048, temperature: 0.7 }
         };
    } else if (modelId.includes("anthropic.claude")) {
         body = {
             anthropic_version: "bedrock-2023-05-31",
             max_tokens: 4096,
             system: systemPrompt,
             messages: [
                 { role: "user", content: userPrompt }
             ],
             temperature: 0.7
         };
    } else {
        // Default to Llama style or error
        throw new Error("Unsupported Bedrock LLM for Strategy");
    }

    try {
        const response = await fetchWithTimeout(AWS_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                modelId,
                body
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Bedrock Strategy Failed');
        }

        const data = await response.json() as any;
        let jsonString = "";

        if (modelId.includes("meta.llama")) {
            jsonString = data.generation;
        } else if (modelId.includes("amazon.nova")) {
            jsonString = data.output.message.content[0].text;
        } else if (modelId.includes("anthropic.claude")) {
            jsonString = data.content[0].text;
        }

        const clean = jsonString.replace(/```json\s*|\s*```/g, '').trim();
        
        // Robust JSON Extraction
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        
        if (start !== -1 && end !== -1) {
            return JSON.parse(clean.substring(start, end + 1));
        }
        
        return JSON.parse(clean);

    } catch (error) {
        console.error("Bedrock Strategy Error:", error);
        throw error;
    }
};

export const generateScenesBedrock = async (formData: FormData, strategy: Partial<GeneratedAsset>, variationHint?: string, modelId: string = "us.meta.llama4-maverick-17b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const targetSceneCount = formData.constraints.scene_count || 5;

    const systemPrompt = `
    You are an Elite UGC Scriptwriter & Expert AI Cinematographer.
    Your job is to translate a viral strategy into a frame-by-frame production script.

    STRICT PACING RULES:
    - TikTok/Reels move FAST. Keep scenes between 2 to 6 seconds max.
    - SCENE 1 MUST be a 3-second visual and auditory Pattern Interrupt.
    - Show, Don't Tell: Match visuals exactly to the spoken audio.

    OUTPUT EXACTLY IN THIS JSON FORMAT:
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
            "image_prompt": "string",
            "image_negative": "text, watermark",
            "video_prompt": "string",
            "video_negative": "text, watermark",
            "camera_movement": "string",
            "key_action": "string",
            "video_params": { "duration": "string", "fps": 30, "aspect_ratio": "9:16", "motion_strength": "5" }
          }
        }
      ]
    }
    `;

    const userPrompt = `
    STRATEGY TO EXECUTE:
    - Concept: ${strategy.concept_title}
    - Hook Rationale: ${strategy.hook_rationale}

    CONSTRAINTS:
    - Target Duration: ${formData.constraints.vo_duration_seconds} seconds
    - Target Scenes: ${targetSceneCount}
    - Language: ${outputLanguage}

    VISUAL DIRECTION:
    - Art Style: ${formData.visual_settings?.art_style || 'Cinematic'}
    - Lighting: ${formData.visual_settings?.lighting || 'Natural'}
    - Camera Angle: ${formData.visual_settings?.camera_angle || 'Eye-level'}

    ${variationHint ? `\nCRITICAL VARIATION INSTRUCTION:\n${variationHint}` : ""}
    
    Write the scenes now.
    `;

    let body: any = {};
    if (modelId.includes("meta.llama")) {
        body = {
            prompt: `\n<|begin_of_text|><|start_header_id|>system<|end_header_id|>\n${systemPrompt}\n<|eot_id|><|start_header_id|>user<|end_header_id|>\n${userPrompt}\n<|eot_id|><|start_header_id|>assistant<|end_header_id|>\n`,
            max_gen_len: 4096, temperature: 0.7, top_p: 0.9
        };
    } else if (modelId.includes("amazon.nova")) {
         body = { system: [{ text: systemPrompt }], messages: [{ role: "user", content: [{ text: userPrompt }] }], inferenceConfig: { max_new_tokens: 2048, temperature: 0.7 } };
    } else if (modelId.includes("anthropic.claude")) {
         body = { anthropic_version: "bedrock-2023-05-31", max_tokens: 4096, system: systemPrompt, messages: [ { role: "user", content: userPrompt } ], temperature: 0.7 };
    }

    try {
        const response = await fetchWithTimeout(AWS_PROXY_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ region, accessKeyId, secretAccessKey, modelId, body })
        });

        if (!response.ok) throw new Error('AWS Bedrock Scenes Failed');
        const data = await response.json() as any;
        
        let jsonString = "";
        if (modelId.includes("meta.llama")) jsonString = data.generation;
        else if (modelId.includes("amazon.nova")) jsonString = data.output.message.content[0].text;
        else if (modelId.includes("anthropic.claude")) jsonString = data.content[0].text;

        const clean = jsonString.replace(/```json\s*|\s*```/g, '').trim();
        const start = clean.indexOf('{');
        const end = clean.lastIndexOf('}');
        return JSON.parse(start !== -1 && end !== -1 ? clean.substring(start, end + 1) : clean);
    } catch (error) {
        console.error("Bedrock Scenes Error:", error);
        throw error;
    }
};



export const analyzeReferenceImageBedrock = async (base64Image: string, type: 'face' | 'outfit', _modelId: string = "us.anthropic.claude-sonnet-4-6"): Promise<string> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    const modelId = "us.anthropic.claude-sonnet-4-6"; // Use Sonnet for vision (Forced)

    if (!accessKeyId || !secretAccessKey) {
        throw new Error("AWS Credentials missing.");
    }

    const prompt = type === 'face' 
        ? "Describe this person's physical appearance in one detailed sentence (age, ethnicity, hair style/color, specific features). Do not mention expression."
        : "Describe this outfit in one detailed sentence (color, fabric, style, specific garments).";

    const body = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 300,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "image",
                        source: {
                            type: "base64",
                            media_type: "image/jpeg",
                            data: base64Image
                        }
                    },
                    {
                        type: "text",
                        text: prompt
                    }
                ]
            }
        ]
    };

    try {
        const response = await fetchWithTimeout(AWS_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                modelId,
                body
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Bedrock Reference Analysis Failed');
        }

        const data = await response.json() as any;
        return data.content[0].text;

    } catch (error) {
        console.error("AWS Bedrock Ref Analysis Error:", error);
        throw error;
    }
};


export const generateVideoBedrock = async (prompt: string, imageBase64?: string): Promise<string> => {
    // ... (Keep existing error message or implementation)
    throw new Error("AWS Bedrock Video Generation (Nova Reel) requires an S3 bucket configuration which is not yet supported in this simple proxy.");
};
