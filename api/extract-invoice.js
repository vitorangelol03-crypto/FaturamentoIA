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
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    console.error("Server Error: GEMINI_API_KEY is not defined.");
    return res.status(500).json({ error: 'Servidor mal configurado: API Key ausente.' });
  }

  try {
    // Definição do Schema JSON para a resposta estruturada
    // Isso garante que o Gemini retorne exatamente os campos que o frontend espera.
    const responseSchema = {
      type: "OBJECT",
      properties: {
        establishment: { type: "STRING", description: "Razão social ou Nome fantasia do estabelecimento", nullable: true },
        date: { type: "STRING", description: "Data da compra no formato YYYY-MM-DD", nullable: true },
        total_amount: { type: "NUMBER", description: "Valor total da nota fiscal", nullable: true },
        cnpj: { type: "STRING", description: "Apenas números do CNPJ do emissor", nullable: true },
        receipt_number: { type: "STRING", description: "Número da nota ou extrato", nullable: true },
        payment_method: { type: "STRING", description: "Forma de pagamento (Crédito, Débito, Pix, Dinheiro)", nullable: true },
        suggested_category: { 
          type: "STRING", 
          description: "Categoria sugerida: Alimentação, Transporte, Saúde, Moradia, Lazer, Educação, Vestuário, Outros",
          nullable: true
        },
        items: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", nullable: true },
              quantity: { type: "NUMBER", nullable: true },
              unitPrice: { type: "NUMBER", nullable: true },
              totalPrice: { type: "NUMBER", nullable: true }
            }
          },
          nullable: true
        }
      }
    };

    // Chamada REST direta para a API do Google (v1beta)
    // Usando gemini-1.5-flash pois é a versão estável e disponível.
    const model = 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{
        parts: [
          {
            text: "Analise esta nota fiscal brasileira (NFC-e, SAT, DANFE). Extraia os dados conforme o schema JSON fornecido."
          },
          {
            inline_data: {
              mime_type: mimeType || 'image/jpeg',
              data: image
            }
          }
        ]
      }],
      generationConfig: {
        response_mime_type: "application/json",
        response_schema: responseSchema,
        temperature: 0.1
      }
    };

    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Gemini API Error (${apiResponse.status}): ${errorText}`);
    }

    const data = await apiResponse.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text;

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