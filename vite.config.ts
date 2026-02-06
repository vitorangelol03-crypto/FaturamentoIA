import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/extract-invoice', async (req, res) => {
          if (req.method === 'OPTIONS') {
            res.writeHead(200, {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST,OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            });
            res.end();
            return;
          }

          if (req.method !== 'POST') {
            res.writeHead(405, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Method not allowed' }));
            return;
          }

          let body = '';
          req.on('data', (chunk: Buffer) => { body += chunk.toString(); });
          req.on('end', async () => {
            try {
              const { image, mimeType } = JSON.parse(body);
              const apiKey = process.env.API_KEY;

              if (!apiKey) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'API_KEY not configured' }));
                return;
              }

              const { GoogleGenAI, Type } = await import('@google/genai');
              const ai = new GoogleGenAI({ apiKey });

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

              const result = await ai.models.generateContent({
                model: 'gemini-flash-latest',
                contents: [
                  {
                    parts: [
                      { text: "Extraia os dados desta nota fiscal brasileira e retorne apenas o JSON puro." },
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
                throw new Error("Empty AI response.");
              }

              let cleanJson = resultText.trim();
              if (cleanJson.startsWith('```')) {
                cleanJson = cleanJson.replace(/^```[a-z]*\n/i, '').replace(/\n```$/g, '').trim();
              }

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(cleanJson);
            } catch (error: any) {
              console.error('API error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Processing error', details: error.message }));
            }
          });
        });
      },
    },
  ],
  server: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
  },
})
