export interface ExtractionResult {
  readable: boolean;
  establishment?: string;
  date?: string;
  issue_date?: string;
  due_date?: string;
  total_amount?: number;
  cnpj?: string;
  receipt_number?: string;
  payment_method?: string;
  suggested_category?: string;
  access_key?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  error?: string;
}

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg', extraImages?: string[]): Promise<ExtractionResult> {
  try {
    const cleanBase64 = base64Image.includes(",") 
      ? base64Image.split(",")[1] 
      : base64Image;

    const body: any = {
      image: cleanBase64,
      mimeType: mimeType || 'image/jpeg'
    };

    if (extraImages && extraImages.length > 0) {
      body.images = extraImages.map(img => ({
        data: img.includes(",") ? img.split(",")[1] : img,
        mimeType: 'image/jpeg'
      }));
    }

    const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
            readable: false,
            error: errorData.details || errorData.error || `Erro HTTP ${response.status}`
        };
    }

    const data = await response.json();

    if (data.readable === false) {
      return {
        readable: false,
        error: data.error || "Imagem não é uma nota fiscal legível"
      };
    }

    if (!data.establishment || data.establishment.trim() === '' || data.total_amount === undefined || data.total_amount === 0) {
      return {
        readable: false,
        error: "Não foi possível identificar os dados da nota fiscal"
      };
    }

    return {
      readable: true,
      ...data
    };

  } catch (error: any) {
    console.error("Erro no serviço de extração:", error);
    return {
      readable: false,
      error: error.message || "Falha na conexão com o serviço de extração"
    };
  }
}

export interface KeyExtractionResult {
  found: boolean;
  access_key: string;
  error?: string;
}

export async function extractAccessKey(base64Image: string, mimeType: string = 'image/jpeg'): Promise<KeyExtractionResult> {
  try {
    const cleanBase64 = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    const response = await fetch('/api/extract-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: cleanBase64, mimeType: mimeType || 'image/jpeg' })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return { found: false, access_key: '', error: errorData.details || errorData.error || `Erro HTTP ${response.status}` };
    }

    const data = await response.json();
    return {
      found: data.found === true && data.access_key?.length === 44,
      access_key: data.access_key || '',
      error: data.error
    };
  } catch (error: any) {
    console.error("Erro na extração de chave:", error);
    return { found: false, access_key: '', error: error.message || "Falha na conexão" };
  }
}
