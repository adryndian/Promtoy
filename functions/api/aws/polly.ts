import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { region, accessKeyId, secretAccessKey, text, voiceId, engine } = await context.request.json() as any;

    if (!region || !accessKeyId || !secretAccessKey || !text || !voiceId) {
      return new Response(JSON.stringify({ error: "Missing AWS credentials or parameters" }), { status: 400 });
    }

    const client = new PollyClient({
      region,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    const command = new SynthesizeSpeechCommand({
      Text: text,
      OutputFormat: "mp3",
      VoiceId: voiceId,
      Engine: engine || "neural",
    });

    const response = await client.send(command);
    
    // Convert stream to base64 (Cloudflare Worker compatible)
    const stream = response.AudioStream as any;
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    
    // Concatenate chunks
    const totalLength = chunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }

    // Convert to base64
    let binary = '';
    const len = result.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(result[i]);
    }
    const base64 = btoa(binary);
    
    return new Response(JSON.stringify({ audioContent: base64 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
