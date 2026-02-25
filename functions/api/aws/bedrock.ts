// Cloudflare Pages Function (Edge Runtime)
// This file handles /api/aws/bedrock (POST)

interface Env {
    // No specific env vars needed here as we pass credentials in body for this prototype
    // In production, you might want to store them in Env if not using BYOK
}

import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request } = context;
  
  try {
      const body = await request.json() as any;
      const { region, accessKeyId, secretAccessKey, modelId, body: bedrockBody } = body;

      if (!region || !accessKeyId || !secretAccessKey || !modelId || !bedrockBody) {
        return new Response(JSON.stringify({ error: "Missing AWS credentials or parameters" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }

      const client = new BedrockRuntimeClient({
        region,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
      });

      const command = new InvokeModelCommand({
        modelId,
        body: JSON.stringify(bedrockBody),
        contentType: "application/json",
        accept: "application/json",
      });

      const response = await client.send(command);
      const responseBody = new TextDecoder().decode(response.body);
      
      return new Response(responseBody, { headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
