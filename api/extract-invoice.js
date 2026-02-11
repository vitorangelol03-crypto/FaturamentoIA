
import { GoogleGenAI, Type } from "@google/genai";

export default async function handler(req, res) {
  // Configuração de CORS para Vercel
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
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { image, mimeType } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Configuração: API_KEY não encontrada.' });
  }

  try {
    // Inicialização correta do SDK
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // Esquema de resposta estruturado
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        establishment: { type: Type.STRING, description: "Nome do estabelecimento" },
        date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
        total_amount: { type: Type.NUMBER, description: "Valor total numérico" },
        cnpj: { type: Type.STRING, description: "CNPJ apenas números" },
        receipt_number: { type: Type.STRING },
        payment_method: { type: Type.STRING },
        suggested_category: { type: Type.STRING },
        access_key: { type: Type.STRING, description: "Chave de acesso da NF-e com 44 dígitos numéricos, geralmente encontrada no rodapé ou QR code da nota" },
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

    // Usando gemini-flash-latest para garantir compatibilidade com a versão free
    const result = await ai.models.generateContent({
      model: 'gemini-flash-latest',
      contents: [
        {
          parts: [
            { text: "Extraia os dados desta nota fiscal brasileira. Procure também a chave de acesso (44 dígitos numéricos geralmente no rodapé ou próximo ao QR code). Retorne apenas o JSON puro." },
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

    const resultText = result.text;
    
    if (!resultText) {
      throw new Error("Resposta vazia da IA.");
    }

    // Limpeza de segurança caso o modelo retorne blocos de código
    let cleanJson = resultText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
    }

    return res.status(200).json(JSON.parse(cleanJson));

  } catch (error) {
    console.error("Erro na API de extração:", error);
    return res.status(500).json({ 
      error: 'Erro interno no processamento', 
      details: error.message 
    });
  }
}
