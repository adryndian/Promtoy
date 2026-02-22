// --- STRATEGY & SCENES (LLM) ---

import { FormData, GeneratedAsset } from "../types";

export const generateStrategyBedrock = async (formData: FormData, contextText: string, modelId: string = "us.meta.llama4-maverick-17b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
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
    } else if (modelId.includes("anthropic.claude")) {
         // Format payload khusus untuk model Claude (Messages API Bedrock)
         body = {
             anthropic_version: "bedrock-2023-05-31",
             max_tokens: 2048,
             system: systemPrompt,
             messages: [
                 { 
                     role: "user", 
                     content: [{ type: "text", text: userPrompt }] 
                 }
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

        // Menyesuaikan cara membaca response berdasarkan model
        if (modelId.includes("meta.llama")) {
            jsonString = data.generation;
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

export const generateScenesBedrock = async (formData: FormData, strategy: Partial<GeneratedAsset>, variationHint?: string, modelId: string = "us.meta.llama4-maverick-17b-instruct-v1:0"): Promise<Partial<GeneratedAsset>> => {
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
    } else if (modelId.includes("anthropic.claude")) {
         // Format payload khusus untuk model Claude (Messages API Bedrock)
         body = {
             anthropic_version: "bedrock-2023-05-31",
             max_tokens: 2048,
             system: systemPrompt,
             messages: [
                 { 
                     role: "user", 
                     content: [{ type: "text", text: userPrompt }] 
                 }
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

        // Menyesuaikan cara membaca response berdasarkan model
        if (modelId.includes("meta.llama")) {
            jsonString = data.generation;
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
