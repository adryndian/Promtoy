// File: functions/api/proxy.ts

// Definisikan tipe dasar untuk environment (supaya TypeScript tidak rewel)
interface Env {
    [key: string]: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        // 1. Baca data yang dikirim dari frontend
        const body = await context.request.json() as any;
        const { provider, url, headers, payload, isBlob } = body;

        // 2. Validasi dasar
        if (!url || !provider) {
            return new Response(JSON.stringify({ error: "Missing proxy parameters (url or provider)" }), { status: 400, headers: { 'Content-Type': 'application/json' } });
        }

        console.log(`[Proxy] Forwarding request to ${provider}: ${url}`);

        // 3. Teruskan permintaan ke API eksternal (Server-to-Server)
        // Ini mem-bypass CORS browser karena dilakukan oleh server Cloudflare
        const response = await fetch(url, {
            method: 'POST',
            headers: headers || { 'Content-Type': 'application/json' },
            body: payload ? JSON.stringify(payload) : undefined
        });

        if (!response.ok) {
            const errText = await response.text();
            console.error(`[Proxy Error] ${provider} responded with ${response.status}: ${errText}`);
            throw new Error(`${provider} API Error: ${response.status} - ${errText.substring(0, 200)}`);
        }

        // 4. Tangani respons berdasarkan tipe data

        // KASUS A: API mengembalikan file mentah (Binary/Blob), contoh: Hugging Face
        if (isBlob) {
            const arrayBuffer = await response.arrayBuffer();
            // Konversi binary ke Base64 string agar bisa dikirim ke frontend
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binary);
            return new Response(JSON.stringify({ base64, isBase64Encoded: true }), { headers: { 'Content-Type': 'application/json' }});
        }

        // KASUS B: API mengembalikan JSON biasa, contoh: Cloudflare AI, Together AI
        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }});

    } catch (error: any) {
        console.error(`[Proxy Fatal Error]`, error);
        // Kembalikan error yang rapi ke frontend
        return new Response(JSON.stringify({ 
            error: error.message || "An internal server error occurred in the proxy function.",
            timestamp: new Date().toISOString()
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
