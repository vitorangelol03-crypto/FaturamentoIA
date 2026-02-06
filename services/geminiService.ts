
import '../constants';

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    // Clean base64 prefix
    const cleanBase64 = base64Image.includes(",") 
      ? base64Image.split(",")[1] 
      : base64Image;

    const validMimeType = mimeType || 'image/jpeg';

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
        let errorMsg = `Erro na API: ${response.status}`;
        try {
            const errorData = await response.json();
            errorMsg = errorData.details || errorData.error || errorMsg;
        } catch (e) {
            // Not a JSON error response
        }
        throw new Error(errorMsg);
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error("Extraction Service Error:", error);
    
    // Friendly fallback so the UI doesn't crash
    return {
        establishment: "Erro na Leitura (Tente Novamente)",
        date: new Date().toISOString().split('T')[0],
        total_amount: 0,
        items: [],
        suggested_category: "Outros"
    };
  }
}
