
// Use ESM import as required by guidelines
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // Configuração de CORS para permitir chamadas do frontend
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Resposta para preflight request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image, mimeType } = req.body;
  // Guidelines require using process.env.API_KEY directly
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("Server Error: API_KEY is not defined.");
    return res.status(500).json({ error: 'Servidor mal configurado: API Key ausente.' });
  }

  try {
    // Initialize GoogleGenAI with named parameter apiKey
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Definição do Schema JSON using Type enum for better reliability
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        establishment: { type: Type.STRING, description: "Razão social ou Nome fantasia do estabelecimento" },
        date: { type: Type.STRING, description: "Data da compra no formato YYYY-MM-DD" },
        total_amount: { type: Type.NUMBER, description: "Valor total da nota fiscal" },
        cnpj: { type: Type.STRING, description: "Apenas números do CNPJ do emissor" },
        receipt_number: { type: Type.STRING, description: "Número da nota ou extrato" },
        payment_method: { type: Type.STRING, description: "Forma de pagamento (Crédito, Débito, Pix, Dinheiro)" },
        suggested_category: { 
          type: Type.STRING, 
          description: "Categoria sugerida: Alimentação, Transporte, Saúde, Moradia, Lazer, Educação, Vestuário, Outros"
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unitPrice: { type: Type.NUMBER },
              totalPrice: { type: Type.NUMBER }
            }
          }
        }
      }
    };

    // Use ai.models.generateContent with 'gemini-3-flash-preview' for extraction tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        {
          parts: [
            {
              text: "Analise esta nota fiscal brasileira (NFC-e, SAT, DANFE). Extraia os dados conforme o schema JSON fornecido."
            },
            {
              inlineData: {
                mimeType: mimeType || 'image/jpeg',
                data: image
              }
            }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    // Extract text from response using the .text property as per guidelines
    const resultText = response.text;

    if (!resultText) {
      throw new Error("A IA não retornou nenhum texto.");
    }

    const jsonResult = JSON.parse(resultText);
    res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Backend Extraction Error:", error);
    res.status(500).json({ 
      error: error.message || 'Erro interno ao processar nota fiscal.',
      details: "Verifique os logs da Vercel para mais informações." 
    });
  }
}
