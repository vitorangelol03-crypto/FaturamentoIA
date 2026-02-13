import { GoogleGenAI, Type } from "@google/genai";

const KEY_EXTRACTION_PROMPT = `Você é um especialista em leitura de notas fiscais brasileiras (NFC-e, NF-e, cupons fiscais).

TAREFA: Encontre e extraia APENAS a CHAVE DE ACESSO (44 dígitos numéricos) desta nota fiscal.

ONDE ENCONTRAR A CHAVE DE ACESSO:
- No rodapé da nota fiscal
- Próximo ao QR Code
- Após "Chave de Acesso" ou "Consulte pela Chave de Acesso"
- Pode estar separada em grupos de 4 dígitos (ex: 3125 0211 8024 6400 0138 ...)
- Pode estar em uma linha contínua de 44 dígitos

REGRAS:
1. Junte TODOS os dígitos em uma string contínua de EXATAMENTE 44 números
2. Se encontrar a chave, retorne found = true e a chave em access_key
3. Se NÃO encontrar exatamente 44 dígitos numéricos, retorne found = false
4. Se a imagem não for uma nota fiscal ou estiver ilegível, retorne found = false

Retorne APENAS o JSON estruturado.`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
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

  if (!image) {
    return res.status(400).json({ error: 'Imagem não fornecida.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        found: { type: Type.BOOLEAN, description: "true se encontrou uma chave de acesso válida com 44 dígitos" },
        access_key: { type: Type.STRING, description: "Chave de acesso com exatamente 44 dígitos numéricos contínuos, ou string vazia se não encontrada" },
      },
      required: ["found", "access_key"]
    };

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts: [
            { text: KEY_EXTRACTION_PROMPT },
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
      return res.status(200).json({ found: false, access_key: '', error: "Resposta vazia da IA" });
    }

    let cleanJson = resultText.trim();
    if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
    }

    const parsed = JSON.parse(cleanJson);

    if (parsed.access_key) {
      parsed.access_key = parsed.access_key.replace(/\D/g, '');
      if (parsed.access_key.length !== 44) {
        parsed.access_key = '';
        parsed.found = false;
      }
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Erro na extração de chave:", error);
    return res.status(500).json({
      found: false,
      access_key: '',
      error: 'Erro interno no processamento',
      details: error.message
    });
  }
}
