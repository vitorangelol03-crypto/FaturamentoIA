
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { image, mimeType } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    console.error("Critical: API_KEY environment variable is missing.");
    return res.status(500).json({ error: 'Erro de configuração: Chave de API não encontrada no servidor.' });
  }

  if (!image) {
    return res.status(400).json({ error: 'Dados da imagem não fornecidos.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
      },
      required: ["establishment", "date", "total_amount"]
    };

    // Use gemini-3-flash-preview as recommended for text-extraction tasks
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          { text: "Você é um especialista em extração de dados de documentos fiscais brasileiros. Extraia com precisão os dados desta imagem e retorne APENAS o JSON, sem explicações ou blocos de código markdown." },
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: image
            }
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("A IA retornou uma resposta vazia.");
    }

    // Defensive parsing: remove potential markdown blocks if the model ignores the mimeType instruction
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json/, '').replace(/```$/, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```/, '').replace(/```$/, '').trim();
    }

    const jsonResult = JSON.parse(cleanJson);
    return res.status(200).json(jsonResult);

  } catch (error) {
    console.error("Detailed Backend Error:", error);
    return res.status(500).json({ 
      error: 'Falha ao processar imagem', 
      details: error.message,
      type: error.constructor.name 
    });
  }
}
