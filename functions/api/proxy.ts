// File: functions/api/proxy.ts

interface Env {
    [key: string]: any;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const body = await context.request.json() as any;
        const { provider, url, headers, payload, isBlob, isMultipart } = body;

        if (!url || !provider) {
            return new Response(JSON.stringify({ error: "Missing proxy parameters" }), { status: 400 });
        }

        let requestOptions: RequestInit = { method: 'POST' };

        // 🔥 KUNCI PERBAIKAN: Format khusus untuk FLUX.2 Cloudflare
        if (isMultipart) {
            const formData = new FormData();
            if (payload) {
                for (const key in payload) {
                    formData.append(key, payload[key]);
                }
            }
            requestOptions.body = formData;
            
            // Fetch akan otomatis membuat boundary Form-Data jika Content-Type dihapus
            const finalHeaders: any = { ...headers };
            delete finalHeaders['Content-Type'];
            requestOptions.headers = finalHeaders;
        } else {
            // Format standar (JSON)
            requestOptions.headers = headers || { 'Content-Type': 'application/json' };
            requestOptions.body = payload ? JSON.stringify(payload) : undefined;
        }

        const response = await fetch(url, requestOptions);

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${provider} API Error: ${response.status} - ${errText.substring(0, 200)}`);
        }

        if (isBlob) {
            const arrayBuffer = await response.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            let binary = '';
            for (let i = 0; i < uint8Array.byteLength; i++) {
                binary += String.fromCharCode(uint8Array[i]);
            }
            const base64 = btoa(binary);
            return new Response(JSON.stringify({ base64, isBase64Encoded: true }), { headers: { 'Content-Type': 'application/json' }});
        }

        const data = await response.json();
        return new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' }});

    } catch (error: any) {
        return new Response(JSON.stringify({ 
            error: error.message || "Proxy error",
        }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
};
