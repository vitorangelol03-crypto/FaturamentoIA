import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'api-middleware',
      configureServer(server) {
        server.middlewares.use('/api/sefaz-monitor', async (req, res) => {
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
              const { action, ultNSU, chave, nsu, location } = JSON.parse(body);

              const locationConfigs: Record<string, { pfxEnv: string; passEnv: string; cnpj: string }> = {
                'Caratinga': { pfxEnv: 'PFX_CERTIFICATE', passEnv: 'PFX_PASSWORD', cnpj: '11802464000138' },
                'Ponte Nova': { pfxEnv: 'PFX_CERTIFICATE_PN', passEnv: 'PFX_PASSWORD_PN', cnpj: '53824315000110' },
              };

              const config = locationConfigs[location || 'Caratinga'];
              if (!config) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Localização inválida.' }));
                return;
              }

              const pfxBase64 = process.env[config.pfxEnv];
              const pfxPassword = process.env[config.passEnv];

              if (!pfxBase64 || !pfxPassword) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: `Certificado PFX não configurado para ${location || 'Caratinga'}.` }));
                return;
              }

              const { DistribuicaoDFe } = await import('node-mde');
              const pfxBuffer = Buffer.from(pfxBase64, 'base64');

              const distribuicao = new DistribuicaoDFe({
                pfx: pfxBuffer,
                passphrase: pfxPassword,
                cnpj: config.cnpj,
                cUFAutor: '31',
                tpAmb: '1',
              });

              let result;

              if (action === 'sync') {
                result = await distribuicao.consultaUltNSU(ultNSU || '000000000000000');
              } else if (action === 'consultaChave') {
                if (!chave) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'Chave de acesso não informada.' }));
                  return;
                }
                result = await distribuicao.consultaChNFe(chave);
              } else if (action === 'consultaNSU') {
                if (!nsu) {
                  res.writeHead(400, { 'Content-Type': 'application/json' });
                  res.end(JSON.stringify({ error: 'NSU não informado.' }));
                  return;
                }
                result = await distribuicao.consultaNSU(nsu);
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Ação inválida.' }));
                return;
              }

              if (result.error) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: result.error }));
                return;
              }

              const data = result.data || result;

              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({
                cStat: data.cStat,
                xMotivo: data.xMotivo,
                ultNSU: data.ultNSU,
                maxNSU: data.maxNSU,
                documents: data.docZip || [],
              }));
            } catch (error: any) {
              console.error('SEFAZ API error:', error);
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Erro ao comunicar com SEFAZ', details: error.message }));
            }
          });
        });

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
