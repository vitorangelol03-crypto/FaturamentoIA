
import '../constants';

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    // Remove prefixo base64 se existir
    const cleanBase64 = base64Image.includes(",") 
      ? base64Image.split(",")[1] 
      : base64Image;

    const response = await fetch('/api/extract-invoice', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            image: cleanBase64,
            mimeType: mimeType || 'image/jpeg'
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.details || errorData.error || `Erro HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error: any) {
    console.error("Erro no serviço de extração:", error);
    
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
