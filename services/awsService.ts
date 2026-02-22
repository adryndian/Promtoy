import { getStoredAwsAccessKey, getStoredAwsSecretKey, getStoredAwsRegion } from './externalService';

const AWS_PROXY_URL = '/api/aws/bedrock';

export const analyzeImageBedrock = async (base64Image: string, mimeType: string = "image/jpeg"): Promise<any> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    const modelId = "anthropic.claude-3-sonnet-20240229-v1:0"; // Claude 3 Sonnet

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
        const response = await fetch(AWS_PROXY_URL, {
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
        
        // Clean JSON
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
  } else if (modelId.includes("amazon.nova")) {
      // Nova Canvas (Converse style or specific body)
      // Nova Canvas uses "textToImageParams" similar to Titan but slightly different schema in some versions.
      // However, the standard Nova Canvas body is:
      body = {
          taskType: "TEXT_IMAGE",
          textToImageParams: { text: prompt },
          imageGenerationConfig: {
              numberOfImages: 1,
              height: 1024,
              width: 1024,
              cfgScale: 8.0,
              seed: Math.floor(Math.random() * 2147483647)
          }
      };
  } else if (modelId.includes("stability.sd3")) {
      body = {
        prompt: prompt,
        mode: "text-to-image",
        aspect_ratio: "1:1",
        output_format: "png"
      };
  } else {
      throw new Error(`Unsupported AWS Bedrock Image Model: ${modelId}`);
  }

  try {
    const response = await fetch(AWS_PROXY_URL, {
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
    if (modelId.startsWith("amazon.titan") || modelId.includes("amazon.nova")) {
        return `data:image/png;base64,${data.images[0]}`;
    } else if (modelId.includes("stability.sd3")) {
        return `data:image/png;base64,${data.images[0]}`;
    }
    
    throw new Error("Unknown response format from AWS Bedrock");

  } catch (error) {
    console.error("AWS Bedrock Image Gen Error:", error);
    throw error;
  }
};

// --- TEXT TO SPEECH (TITAN/POLLY) ---

export const generateSpeechBedrock = async (text: string, voiceId: string = "Joanna"): Promise<string> => {
    // ... (This function delegates to Polly, so we update Polly function below)
    return generateSpeechPolly(text, voiceId);
};

const generateSpeechPolly = async (text: string, voiceId: string): Promise<string> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();

    // We need a new proxy endpoint for Polly because it uses a different client
    const POLLY_PROXY_URL = '/api/aws/polly';

    try {
        const response = await fetch(POLLY_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                region,
                accessKeyId,
                secretAccessKey,
                text,
                voiceId,
                engine: "neural" // Use neural engine for better quality
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error || 'AWS Polly Request Failed');
        }

        const data = await response.json() as any;
        // Expecting base64 audio
        return `data:audio/mp3;base64,${data.audioContent}`;
    } catch (error) {
        console.error("AWS Polly TTS Error:", error);
        throw error;
    }
}

// --- STRATEGY & SCENES (LLM) ---

import { FormData, GeneratedAsset } from "../types";

export const generateStrategyBedrock = async (formData: FormData, contextText: string, modelId: string = "meta.llama3-1-70b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();

    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    
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
            max_gen_len: 2048,
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
        const response = await fetch(AWS_PROXY_URL, {
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
        return JSON.parse(clean);

    } catch (error) {
        console.error("Bedrock Strategy Error:", error);
        throw error;
    }
};

export const generateScenesBedrock = async (formData: FormData, strategy: Partial<GeneratedAsset>, variationHint?: string, modelId: string = "meta.llama3-1-70b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    
    const outputLanguage = formData.constraints.language === 'en' ? 'English' : 'Indonesian (Bahasa Indonesia)';
    const targetSceneCount = formData.constraints.scene_count || 5;

    const systemPrompt = `
    You are an Elite UGC Scriptwriter. Write a production-ready script.
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
            "image_prompt": "string",
            "video_prompt": "string"
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
            max_gen_len: 2048,
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
    }

    try {
        const response = await fetch(AWS_PROXY_URL, {
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
            throw new Error(err.error || 'AWS Bedrock Scenes Failed');
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
        return JSON.parse(clean);

    } catch (error) {
        console.error("Bedrock Scenes Error:", error);
        throw error;
    }
};

export const analyzeReferenceImageBedrock = async (base64Image: string, type: 'face' | 'outfit'): Promise<string> => {
    const accessKeyId = getStoredAwsAccessKey().trim();
    const secretAccessKey = getStoredAwsSecretKey().trim();
    const region = getStoredAwsRegion().trim();
    const modelId = "anthropic.claude-3-sonnet-20240229-v1:0"; // Use Sonnet for vision

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
        const response = await fetch(AWS_PROXY_URL, {
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
