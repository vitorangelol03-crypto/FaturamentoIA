import '../constants';

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    // 1. Limpeza Segura do Base64 (remove o prefixo 'data:image/jpeg;base64,')
    const cleanBase64 = base64Image.includes(",") 
      ? base64Image.split(",")[1] 
      : base64Image;

    const validMimeType = mimeType || 'image/jpeg';

    // 2. Chamada para a Serverless Function local (/api/extract-invoice)
    // A chave de API agora está segura no servidor e não passa pelo navegador.
    const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: cleanBase64,
            mimeType: validMimeType
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Erro na API: ${response.status}`);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Extraction Service Error:", error);
    
    // Fallback amigável para a interface não travar
    return {
        establishment: "Erro na Leitura (Tente Novamente)",
        date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        items: [],
        suggested_category: "Outros"
    };
  }
}