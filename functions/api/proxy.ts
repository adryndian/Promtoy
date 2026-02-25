// File: functions/api/proxy.ts
export const onRequestPost: PagesFunction = async (context) => {
    try {
        const body = await context.request.json() as any;
        const { provider, url, headers, payload, isBlob } = body;

        if (!url || !provider) {
            return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
        }

        const response = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${provider} API Error: ${response.status} - ${errText}`);
        }

        // Jika API mengembalikan file mentah (seperti Hugging Face)
        if (isBlob) {
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binary);
            return new Response(JSON.stringify({ base64 }), { headers: { 'Content-Type': 'application/json' }});
        }

        // Jika API mengembalikan JSON (seperti Cloudflare & Together)
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }});

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
