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
    
    // Convert stream to base64
    const stream = response.AudioStream as any;
    const chunks = [];
    for await (const chunk of stream) {
        chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const base64 = buffer.toString("base64");
    
    return new Response(JSON.stringify({ audioContent: base64 }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
};
