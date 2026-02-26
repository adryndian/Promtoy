import { GeneratedAsset, FormData } from '../types';
import { fetchWithTimeout } from './externalService';

export interface SavedGeneration {
  id: string;
  created_at: string;
  brand_name: string;
  product_type: string;
  input_brief: FormData;
  output_plan: GeneratedAsset;
  user_id: string;
}

const API_BASE = '/api/generations';

export const saveGeneration = async (
  formData: FormData,
  result: GeneratedAsset,
  userId: string = 'anonymous'
): Promise<SavedGeneration | null> => {
  try {
    const id = self.crypto.randomUUID();
    const payload = {
      id,
      brand_name: formData.brand.name,
      product_type: formData.product.type,
      input_brief: formData,
      output_plan: result,
      user_id: userId
    };

    const response = await fetchWithTimeout(API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) throw new Error('Failed to save generation');
    
    const data = await response.json();
    
    return {
      ...payload,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error saving generation:', error);
    return null;
  }
};

export const updateGeneration = async (
  id: string,
  result: GeneratedAsset,
  formData: FormData,
  userId: string
): Promise<void> => {
    const payload = {
      id,
      brand_name: formData.brand.name,
      product_type: formData.product.type,
      input_brief: formData,
      output_plan: result,
      user_id: userId
    };

    try {
        await fetchWithTimeout(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error('Error updating generation:', error);
    }
};

export const fetchHistory = async (userId: string = 'anonymous'): Promise<SavedGeneration[]> => {
  try {
    const response = await fetchWithTimeout(`${API_BASE}?user_id=${userId}`);
    if (!response.ok) throw new Error('Failed to fetch history');
    return await response.json();
  } catch (error) {
    console.error('Error fetching history:', error);
    return [];
  }
};

export const deleteGeneration = async (id: string): Promise<void> => {
  try {
    await fetchWithTimeout(`${API_BASE}/${id}`, { method: 'DELETE' });
  } catch (error) {
    console.error('Error deleting generation:', error);
  }
};

export const uploadAsset = async (file: File): Promise<string | null> => {
    try {
        const reader = new FileReader();
        return new Promise((resolve) => {
            reader.onloadend = async () => {
                const base64String = (reader.result as string).split(',')[1];
                const payload = {
                    filename: file.name,
                    contentBase64: base64String,
                    contentType: file.type
                };

                try {
                    const response = await fetchWithTimeout('/api/upload', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    });

                    if (!response.ok) throw new Error('Upload failed');
                    
                    const data = await response.json() as { success: boolean, url: string };
                    resolve(data.url);
                } catch (e) {
                    console.error("Upload error:", e);
                    resolve(null);
                }
            };
            reader.readAsDataURL(file);
        });
    } catch (error) {
        console.error("File reading error:", error);
        return null;
    }
};

export const uploadBase64Asset = async (base64DataUri: string, contentType: string, filename: string): Promise<string | null> => {
    try {
        // Pisahkan header "data:image/jpeg;base64," dari konten aslinya
        const cleanBase64 = base64DataUri.includes(',') ? base64DataUri.split(',')[1] : base64DataUri;
        
        const payload = {
            filename,
            contentBase64: cleanBase64,
            contentType
        };

        const response = await fetchWithTimeout('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('R2 Upload failed');
        
        const data = await response.json() as { success: boolean, url: string };
        return data.url; // Akan mengembalikan URL seperti "/api/assets/123-img.jpg"
    } catch (e) {
        console.error("R2 Upload error:", e);
        return null;
    }
};

