// vite.config.ts
import { defineConfig } from "file:///home/runner/workspace/node_modules/vite/dist/node/index.js";
import react from "file:///home/runner/workspace/node_modules/@vitejs/plugin-react/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    {
      name: "api-middleware",
      configureServer(server) {
        server.middlewares.use("/api/sefaz-monitor", async (req, res) => {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            });
            res.end();
            return;
          }
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", async () => {
            try {
              const { action, ultNSU, chave, nsu } = JSON.parse(body);
              const pfxBase64 = process.env.PFX_CERTIFICATE;
              const pfxPassword = process.env.PFX_PASSWORD;
              if (!pfxBase64 || !pfxPassword) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Certificado PFX n\xE3o configurado." }));
                return;
              }
              const { DistribuicaoDFe } = await import("file:///home/runner/workspace/node_modules/node-mde/lib/index.js");
              const pfxBuffer = Buffer.from(pfxBase64, "base64");
              const distribuicao = new DistribuicaoDFe({
                pfx: pfxBuffer,
                passphrase: pfxPassword,
                cnpj: "11802464000138",
                cUFAutor: "31",
                tpAmb: "1"
              });
              let result;
              if (action === "sync") {
                result = await distribuicao.consultaUltNSU(ultNSU || "000000000000000");
              } else if (action === "consultaChave") {
                if (!chave) {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "Chave de acesso n\xE3o informada." }));
                  return;
                }
                result = await distribuicao.consultaChNFe(chave);
              } else if (action === "consultaNSU") {
                if (!nsu) {
                  res.writeHead(400, { "Content-Type": "application/json" });
                  res.end(JSON.stringify({ error: "NSU n\xE3o informado." }));
                  return;
                }
                result = await distribuicao.consultaNSU(nsu);
              } else {
                res.writeHead(400, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "A\xE7\xE3o inv\xE1lida." }));
                return;
              }
              if (result.error) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: result.error }));
                return;
              }
              const data = result.data || result;
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(JSON.stringify({
                cStat: data.cStat,
                xMotivo: data.xMotivo,
                ultNSU: data.ultNSU,
                maxNSU: data.maxNSU,
                documents: data.docZip || []
              }));
            } catch (error) {
              console.error("SEFAZ API error:", error);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Erro ao comunicar com SEFAZ", details: error.message }));
            }
          });
        });
        server.middlewares.use("/api/extract-invoice", async (req, res) => {
          if (req.method === "OPTIONS") {
            res.writeHead(200, {
              "Access-Control-Allow-Origin": "*",
              "Access-Control-Allow-Methods": "POST,OPTIONS",
              "Access-Control-Allow-Headers": "Content-Type"
            });
            res.end();
            return;
          }
          if (req.method !== "POST") {
            res.writeHead(405, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ error: "Method not allowed" }));
            return;
          }
          let body = "";
          req.on("data", (chunk) => {
            body += chunk.toString();
          });
          req.on("end", async () => {
            try {
              const { image, mimeType } = JSON.parse(body);
              const apiKey = process.env.API_KEY;
              if (!apiKey) {
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "API_KEY not configured" }));
                return;
              }
              const { GoogleGenAI, Type } = await import("file:///home/runner/workspace/node_modules/@google/genai/dist/node/index.js");
              const ai = new GoogleGenAI({ apiKey });
              const responseSchema = {
                type: Type.OBJECT,
                properties: {
                  establishment: { type: Type.STRING, description: "Nome do estabelecimento" },
                  date: { type: Type.STRING, description: "Data no formato YYYY-MM-DD" },
                  total_amount: { type: Type.NUMBER, description: "Valor total num\xE9rico" },
                  cnpj: { type: Type.STRING, description: "CNPJ apenas n\xFAmeros" },
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
                model: "gemini-flash-latest",
                contents: [
                  {
                    parts: [
                      { text: "Extraia os dados desta nota fiscal brasileira e retorne apenas o JSON puro." },
                      {
                        inlineData: {
                          mimeType: mimeType || "image/jpeg",
                          data: image
                        }
                      }
                    ]
                  }
                ],
                config: {
                  responseMimeType: "application/json",
                  responseSchema,
                  temperature: 0.1
                }
              });
              const resultText = result.text;
              if (!resultText) {
                throw new Error("Empty AI response.");
              }
              let cleanJson = resultText.trim();
              if (cleanJson.startsWith("```")) {
                cleanJson = cleanJson.replace(/^```[a-z]*\n/i, "").replace(/\n```$/g, "").trim();
              }
              res.writeHead(200, { "Content-Type": "application/json" });
              res.end(cleanJson);
            } catch (error) {
              console.error("API error:", error);
              res.writeHead(500, { "Content-Type": "application/json" });
              res.end(JSON.stringify({ error: "Processing error", details: error.message }));
            }
          });
        });
      }
    }
  ],
  server: {
    host: "0.0.0.0",
    port: 5e3,
    allowedHosts: true
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCIvaG9tZS9ydW5uZXIvd29ya3NwYWNlL3ZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9ob21lL3J1bm5lci93b3Jrc3BhY2Uvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbXG4gICAgcmVhY3QoKSxcbiAgICB7XG4gICAgICBuYW1lOiAnYXBpLW1pZGRsZXdhcmUnLFxuICAgICAgY29uZmlndXJlU2VydmVyKHNlcnZlcikge1xuICAgICAgICBzZXJ2ZXIubWlkZGxld2FyZXMudXNlKCcvYXBpL3NlZmF6LW1vbml0b3InLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdQT1NULE9QVElPTlMnLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDUsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBib2R5ID0gJyc7XG4gICAgICAgICAgcmVxLm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHsgYm9keSArPSBjaHVuay50b1N0cmluZygpOyB9KTtcbiAgICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgYWN0aW9uLCB1bHROU1UsIGNoYXZlLCBuc3UgfSA9IEpTT04ucGFyc2UoYm9keSk7XG5cbiAgICAgICAgICAgICAgY29uc3QgcGZ4QmFzZTY0ID0gcHJvY2Vzcy5lbnYuUEZYX0NFUlRJRklDQVRFO1xuICAgICAgICAgICAgICBjb25zdCBwZnhQYXNzd29yZCA9IHByb2Nlc3MuZW52LlBGWF9QQVNTV09SRDtcblxuICAgICAgICAgICAgICBpZiAoIXBmeEJhc2U2NCB8fCAhcGZ4UGFzc3dvcmQpIHtcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ0NlcnRpZmljYWRvIFBGWCBuXHUwMEUzbyBjb25maWd1cmFkby4nIH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCB7IERpc3RyaWJ1aWNhb0RGZSB9ID0gYXdhaXQgaW1wb3J0KCdub2RlLW1kZScpO1xuICAgICAgICAgICAgICBjb25zdCBwZnhCdWZmZXIgPSBCdWZmZXIuZnJvbShwZnhCYXNlNjQsICdiYXNlNjQnKTtcblxuICAgICAgICAgICAgICBjb25zdCBkaXN0cmlidWljYW8gPSBuZXcgRGlzdHJpYnVpY2FvREZlKHtcbiAgICAgICAgICAgICAgICBwZng6IHBmeEJ1ZmZlcixcbiAgICAgICAgICAgICAgICBwYXNzcGhyYXNlOiBwZnhQYXNzd29yZCxcbiAgICAgICAgICAgICAgICBjbnBqOiAnMTE4MDI0NjQwMDAxMzgnLFxuICAgICAgICAgICAgICAgIGNVRkF1dG9yOiAnMzEnLFxuICAgICAgICAgICAgICAgIHRwQW1iOiAnMScsXG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGxldCByZXN1bHQ7XG5cbiAgICAgICAgICAgICAgaWYgKGFjdGlvbiA9PT0gJ3N5bmMnKSB7XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZGlzdHJpYnVpY2FvLmNvbnN1bHRhVWx0TlNVKHVsdE5TVSB8fCAnMDAwMDAwMDAwMDAwMDAwJyk7XG4gICAgICAgICAgICAgIH0gZWxzZSBpZiAoYWN0aW9uID09PSAnY29uc3VsdGFDaGF2ZScpIHtcbiAgICAgICAgICAgICAgICBpZiAoIWNoYXZlKSB7XG4gICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnQ2hhdmUgZGUgYWNlc3NvIG5cdTAwRTNvIGluZm9ybWFkYS4nIH0pKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZGlzdHJpYnVpY2FvLmNvbnN1bHRhQ2hORmUoY2hhdmUpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKGFjdGlvbiA9PT0gJ2NvbnN1bHRhTlNVJykge1xuICAgICAgICAgICAgICAgIGlmICghbnN1KSB7XG4gICAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDQwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnTlNVIG5cdTAwRTNvIGluZm9ybWFkby4nIH0pKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmVzdWx0ID0gYXdhaXQgZGlzdHJpYnVpY2FvLmNvbnN1bHRhTlNVKG5zdSk7XG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdBXHUwMEU3XHUwMEUzbyBpbnZcdTAwRTFsaWRhLicgfSkpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGlmIChyZXN1bHQuZXJyb3IpIHtcbiAgICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogcmVzdWx0LmVycm9yIH0pKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBkYXRhID0gcmVzdWx0LmRhdGEgfHwgcmVzdWx0O1xuXG4gICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgICAgICAgIGNTdGF0OiBkYXRhLmNTdGF0LFxuICAgICAgICAgICAgICAgIHhNb3Rpdm86IGRhdGEueE1vdGl2byxcbiAgICAgICAgICAgICAgICB1bHROU1U6IGRhdGEudWx0TlNVLFxuICAgICAgICAgICAgICAgIG1heE5TVTogZGF0YS5tYXhOU1UsXG4gICAgICAgICAgICAgICAgZG9jdW1lbnRzOiBkYXRhLmRvY1ppcCB8fCBbXSxcbiAgICAgICAgICAgICAgfSkpO1xuICAgICAgICAgICAgfSBjYXRjaCAoZXJyb3I6IGFueSkge1xuICAgICAgICAgICAgICBjb25zb2xlLmVycm9yKCdTRUZBWiBBUEkgZXJyb3I6JywgZXJyb3IpO1xuICAgICAgICAgICAgICByZXMud3JpdGVIZWFkKDUwMCwgeyAnQ29udGVudC1UeXBlJzogJ2FwcGxpY2F0aW9uL2pzb24nIH0pO1xuICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdFcnJvIGFvIGNvbXVuaWNhciBjb20gU0VGQVonLCBkZXRhaWxzOiBlcnJvci5tZXNzYWdlIH0pKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KTtcbiAgICAgICAgfSk7XG5cbiAgICAgICAgc2VydmVyLm1pZGRsZXdhcmVzLnVzZSgnL2FwaS9leHRyYWN0LWludm9pY2UnLCBhc3luYyAocmVxLCByZXMpID0+IHtcbiAgICAgICAgICBpZiAocmVxLm1ldGhvZCA9PT0gJ09QVElPTlMnKSB7XG4gICAgICAgICAgICByZXMud3JpdGVIZWFkKDIwMCwge1xuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctT3JpZ2luJzogJyonLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctTWV0aG9kcyc6ICdQT1NULE9QVElPTlMnLFxuICAgICAgICAgICAgICAnQWNjZXNzLUNvbnRyb2wtQWxsb3ctSGVhZGVycyc6ICdDb250ZW50LVR5cGUnLFxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICByZXMuZW5kKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgfVxuXG4gICAgICAgICAgaWYgKHJlcS5tZXRob2QgIT09ICdQT1NUJykge1xuICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg0MDUsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgIHJlcy5lbmQoSlNPTi5zdHJpbmdpZnkoeyBlcnJvcjogJ01ldGhvZCBub3QgYWxsb3dlZCcgfSkpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIGxldCBib2R5ID0gJyc7XG4gICAgICAgICAgcmVxLm9uKCdkYXRhJywgKGNodW5rOiBCdWZmZXIpID0+IHsgYm9keSArPSBjaHVuay50b1N0cmluZygpOyB9KTtcbiAgICAgICAgICByZXEub24oJ2VuZCcsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICAgIGNvbnN0IHsgaW1hZ2UsIG1pbWVUeXBlIH0gPSBKU09OLnBhcnNlKGJvZHkpO1xuICAgICAgICAgICAgICBjb25zdCBhcGlLZXkgPSBwcm9jZXNzLmVudi5BUElfS0VZO1xuXG4gICAgICAgICAgICAgIGlmICghYXBpS2V5KSB7XG4gICAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgICByZXMuZW5kKEpTT04uc3RyaW5naWZ5KHsgZXJyb3I6ICdBUElfS0VZIG5vdCBjb25maWd1cmVkJyB9KSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgeyBHb29nbGVHZW5BSSwgVHlwZSB9ID0gYXdhaXQgaW1wb3J0KCdAZ29vZ2xlL2dlbmFpJyk7XG4gICAgICAgICAgICAgIGNvbnN0IGFpID0gbmV3IEdvb2dsZUdlbkFJKHsgYXBpS2V5IH0pO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlU2NoZW1hID0ge1xuICAgICAgICAgICAgICAgIHR5cGU6IFR5cGUuT0JKRUNULFxuICAgICAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgICAgIGVzdGFibGlzaG1lbnQ6IHsgdHlwZTogVHlwZS5TVFJJTkcsIGRlc2NyaXB0aW9uOiBcIk5vbWUgZG8gZXN0YWJlbGVjaW1lbnRvXCIgfSxcbiAgICAgICAgICAgICAgICAgIGRhdGU6IHsgdHlwZTogVHlwZS5TVFJJTkcsIGRlc2NyaXB0aW9uOiBcIkRhdGEgbm8gZm9ybWF0byBZWVlZLU1NLUREXCIgfSxcbiAgICAgICAgICAgICAgICAgIHRvdGFsX2Ftb3VudDogeyB0eXBlOiBUeXBlLk5VTUJFUiwgZGVzY3JpcHRpb246IFwiVmFsb3IgdG90YWwgbnVtXHUwMEU5cmljb1wiIH0sXG4gICAgICAgICAgICAgICAgICBjbnBqOiB7IHR5cGU6IFR5cGUuU1RSSU5HLCBkZXNjcmlwdGlvbjogXCJDTlBKIGFwZW5hcyBuXHUwMEZBbWVyb3NcIiB9LFxuICAgICAgICAgICAgICAgICAgcmVjZWlwdF9udW1iZXI6IHsgdHlwZTogVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgICAgICAgICAgIHBheW1lbnRfbWV0aG9kOiB7IHR5cGU6IFR5cGUuU1RSSU5HIH0sXG4gICAgICAgICAgICAgICAgICBzdWdnZXN0ZWRfY2F0ZWdvcnk6IHsgdHlwZTogVHlwZS5TVFJJTkcgfSxcbiAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgIHR5cGU6IFR5cGUuQVJSQVksXG4gICAgICAgICAgICAgICAgICAgIGl0ZW1zOiB7XG4gICAgICAgICAgICAgICAgICAgICAgdHlwZTogVHlwZS5PQkpFQ1QsXG4gICAgICAgICAgICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZTogeyB0eXBlOiBUeXBlLlNUUklORyB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgcXVhbnRpdHk6IHsgdHlwZTogVHlwZS5OVU1CRVIgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIHVuaXRQcmljZTogeyB0eXBlOiBUeXBlLk5VTUJFUiB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgdG90YWxQcmljZTogeyB0eXBlOiBUeXBlLk5VTUJFUiB9XG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICByZXF1aXJlZDogW1wiZXN0YWJsaXNobWVudFwiLCBcImRhdGVcIiwgXCJ0b3RhbF9hbW91bnRcIl1cbiAgICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgICBjb25zdCByZXN1bHQgPSBhd2FpdCBhaS5tb2RlbHMuZ2VuZXJhdGVDb250ZW50KHtcbiAgICAgICAgICAgICAgICBtb2RlbDogJ2dlbWluaS1mbGFzaC1sYXRlc3QnLFxuICAgICAgICAgICAgICAgIGNvbnRlbnRzOiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIHBhcnRzOiBbXG4gICAgICAgICAgICAgICAgICAgICAgeyB0ZXh0OiBcIkV4dHJhaWEgb3MgZGFkb3MgZGVzdGEgbm90YSBmaXNjYWwgYnJhc2lsZWlyYSBlIHJldG9ybmUgYXBlbmFzIG8gSlNPTiBwdXJvLlwiIH0sXG4gICAgICAgICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgICAgICAgaW5saW5lRGF0YToge1xuICAgICAgICAgICAgICAgICAgICAgICAgICBtaW1lVHlwZTogbWltZVR5cGUgfHwgJ2ltYWdlL2pwZWcnLFxuICAgICAgICAgICAgICAgICAgICAgICAgICBkYXRhOiBpbWFnZVxuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgXVxuICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgICAgY29uZmlnOiB7XG4gICAgICAgICAgICAgICAgICByZXNwb25zZU1pbWVUeXBlOiBcImFwcGxpY2F0aW9uL2pzb25cIixcbiAgICAgICAgICAgICAgICAgIHJlc3BvbnNlU2NoZW1hOiByZXNwb25zZVNjaGVtYSxcbiAgICAgICAgICAgICAgICAgIHRlbXBlcmF0dXJlOiAwLjFcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH0pO1xuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3VsdFRleHQgPSByZXN1bHQudGV4dDtcbiAgICAgICAgICAgICAgaWYgKCFyZXN1bHRUZXh0KSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKFwiRW1wdHkgQUkgcmVzcG9uc2UuXCIpO1xuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgbGV0IGNsZWFuSnNvbiA9IHJlc3VsdFRleHQudHJpbSgpO1xuICAgICAgICAgICAgICBpZiAoY2xlYW5Kc29uLnN0YXJ0c1dpdGgoJ2BgYCcpKSB7XG4gICAgICAgICAgICAgICAgY2xlYW5Kc29uID0gY2xlYW5Kc29uLnJlcGxhY2UoL15gYGBbYS16XSpcXG4vaSwgJycpLnJlcGxhY2UoL1xcbmBgYCQvZywgJycpLnRyaW0oKTtcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIHJlcy53cml0ZUhlYWQoMjAwLCB7ICdDb250ZW50LVR5cGUnOiAnYXBwbGljYXRpb24vanNvbicgfSk7XG4gICAgICAgICAgICAgIHJlcy5lbmQoY2xlYW5Kc29uKTtcbiAgICAgICAgICAgIH0gY2F0Y2ggKGVycm9yOiBhbnkpIHtcbiAgICAgICAgICAgICAgY29uc29sZS5lcnJvcignQVBJIGVycm9yOicsIGVycm9yKTtcbiAgICAgICAgICAgICAgcmVzLndyaXRlSGVhZCg1MDAsIHsgJ0NvbnRlbnQtVHlwZSc6ICdhcHBsaWNhdGlvbi9qc29uJyB9KTtcbiAgICAgICAgICAgICAgcmVzLmVuZChKU09OLnN0cmluZ2lmeSh7IGVycm9yOiAnUHJvY2Vzc2luZyBlcnJvcicsIGRldGFpbHM6IGVycm9yLm1lc3NhZ2UgfSkpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pO1xuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgfSxcbiAgXSxcbiAgc2VydmVyOiB7XG4gICAgaG9zdDogJzAuMC4wLjAnLFxuICAgIHBvcnQ6IDUwMDAsXG4gICAgYWxsb3dlZEhvc3RzOiB0cnVlLFxuICB9LFxufSlcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1AsU0FBUyxvQkFBb0I7QUFDalIsT0FBTyxXQUFXO0FBRWxCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVM7QUFBQSxJQUNQLE1BQU07QUFBQSxJQUNOO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixnQkFBZ0IsUUFBUTtBQUN0QixlQUFPLFlBQVksSUFBSSxzQkFBc0IsT0FBTyxLQUFLLFFBQVE7QUFDL0QsY0FBSSxJQUFJLFdBQVcsV0FBVztBQUM1QixnQkFBSSxVQUFVLEtBQUs7QUFBQSxjQUNqQiwrQkFBK0I7QUFBQSxjQUMvQixnQ0FBZ0M7QUFBQSxjQUNoQyxnQ0FBZ0M7QUFBQSxZQUNsQyxDQUFDO0FBQ0QsZ0JBQUksSUFBSTtBQUNSO0FBQUEsVUFDRjtBQUVBLGNBQUksSUFBSSxXQUFXLFFBQVE7QUFDekIsZ0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGdCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3ZEO0FBQUEsVUFDRjtBQUVBLGNBQUksT0FBTztBQUNYLGNBQUksR0FBRyxRQUFRLENBQUMsVUFBa0I7QUFBRSxvQkFBUSxNQUFNLFNBQVM7QUFBQSxVQUFHLENBQUM7QUFDL0QsY0FBSSxHQUFHLE9BQU8sWUFBWTtBQUN4QixnQkFBSTtBQUNGLG9CQUFNLEVBQUUsUUFBUSxRQUFRLE9BQU8sSUFBSSxJQUFJLEtBQUssTUFBTSxJQUFJO0FBRXRELG9CQUFNLFlBQVksUUFBUSxJQUFJO0FBQzlCLG9CQUFNLGNBQWMsUUFBUSxJQUFJO0FBRWhDLGtCQUFJLENBQUMsYUFBYSxDQUFDLGFBQWE7QUFDOUIsb0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELG9CQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxzQ0FBbUMsQ0FBQyxDQUFDO0FBQ3JFO0FBQUEsY0FDRjtBQUVBLG9CQUFNLEVBQUUsZ0JBQWdCLElBQUksTUFBTSxPQUFPLGtFQUFVO0FBQ25ELG9CQUFNLFlBQVksT0FBTyxLQUFLLFdBQVcsUUFBUTtBQUVqRCxvQkFBTSxlQUFlLElBQUksZ0JBQWdCO0FBQUEsZ0JBQ3ZDLEtBQUs7QUFBQSxnQkFDTCxZQUFZO0FBQUEsZ0JBQ1osTUFBTTtBQUFBLGdCQUNOLFVBQVU7QUFBQSxnQkFDVixPQUFPO0FBQUEsY0FDVCxDQUFDO0FBRUQsa0JBQUk7QUFFSixrQkFBSSxXQUFXLFFBQVE7QUFDckIseUJBQVMsTUFBTSxhQUFhLGVBQWUsVUFBVSxpQkFBaUI7QUFBQSxjQUN4RSxXQUFXLFdBQVcsaUJBQWlCO0FBQ3JDLG9CQUFJLENBQUMsT0FBTztBQUNWLHNCQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQztBQUN6RCxzQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sb0NBQWlDLENBQUMsQ0FBQztBQUNuRTtBQUFBLGdCQUNGO0FBQ0EseUJBQVMsTUFBTSxhQUFhLGNBQWMsS0FBSztBQUFBLGNBQ2pELFdBQVcsV0FBVyxlQUFlO0FBQ25DLG9CQUFJLENBQUMsS0FBSztBQUNSLHNCQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQztBQUN6RCxzQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sd0JBQXFCLENBQUMsQ0FBQztBQUN2RDtBQUFBLGdCQUNGO0FBQ0EseUJBQVMsTUFBTSxhQUFhLFlBQVksR0FBRztBQUFBLGNBQzdDLE9BQU87QUFDTCxvQkFBSSxVQUFVLEtBQUssRUFBRSxnQkFBZ0IsbUJBQW1CLENBQUM7QUFDekQsb0JBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLDBCQUFpQixDQUFDLENBQUM7QUFDbkQ7QUFBQSxjQUNGO0FBRUEsa0JBQUksT0FBTyxPQUFPO0FBQ2hCLG9CQUFJLFVBQVUsS0FBSyxFQUFFLGdCQUFnQixtQkFBbUIsQ0FBQztBQUN6RCxvQkFBSSxJQUFJLEtBQUssVUFBVSxFQUFFLE9BQU8sT0FBTyxNQUFNLENBQUMsQ0FBQztBQUMvQztBQUFBLGNBQ0Y7QUFFQSxvQkFBTSxPQUFPLE9BQU8sUUFBUTtBQUU1QixrQkFBSSxVQUFVLEtBQUssRUFBRSxnQkFBZ0IsbUJBQW1CLENBQUM7QUFDekQsa0JBQUksSUFBSSxLQUFLLFVBQVU7QUFBQSxnQkFDckIsT0FBTyxLQUFLO0FBQUEsZ0JBQ1osU0FBUyxLQUFLO0FBQUEsZ0JBQ2QsUUFBUSxLQUFLO0FBQUEsZ0JBQ2IsUUFBUSxLQUFLO0FBQUEsZ0JBQ2IsV0FBVyxLQUFLLFVBQVUsQ0FBQztBQUFBLGNBQzdCLENBQUMsQ0FBQztBQUFBLFlBQ0osU0FBUyxPQUFZO0FBQ25CLHNCQUFRLE1BQU0sb0JBQW9CLEtBQUs7QUFDdkMsa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGtCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTywrQkFBK0IsU0FBUyxNQUFNLFFBQVEsQ0FBQyxDQUFDO0FBQUEsWUFDMUY7QUFBQSxVQUNGLENBQUM7QUFBQSxRQUNILENBQUM7QUFFRCxlQUFPLFlBQVksSUFBSSx3QkFBd0IsT0FBTyxLQUFLLFFBQVE7QUFDakUsY0FBSSxJQUFJLFdBQVcsV0FBVztBQUM1QixnQkFBSSxVQUFVLEtBQUs7QUFBQSxjQUNqQiwrQkFBK0I7QUFBQSxjQUMvQixnQ0FBZ0M7QUFBQSxjQUNoQyxnQ0FBZ0M7QUFBQSxZQUNsQyxDQUFDO0FBQ0QsZ0JBQUksSUFBSTtBQUNSO0FBQUEsVUFDRjtBQUVBLGNBQUksSUFBSSxXQUFXLFFBQVE7QUFDekIsZ0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGdCQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyxxQkFBcUIsQ0FBQyxDQUFDO0FBQ3ZEO0FBQUEsVUFDRjtBQUVBLGNBQUksT0FBTztBQUNYLGNBQUksR0FBRyxRQUFRLENBQUMsVUFBa0I7QUFBRSxvQkFBUSxNQUFNLFNBQVM7QUFBQSxVQUFHLENBQUM7QUFDL0QsY0FBSSxHQUFHLE9BQU8sWUFBWTtBQUN4QixnQkFBSTtBQUNGLG9CQUFNLEVBQUUsT0FBTyxTQUFTLElBQUksS0FBSyxNQUFNLElBQUk7QUFDM0Msb0JBQU0sU0FBUyxRQUFRLElBQUk7QUFFM0Isa0JBQUksQ0FBQyxRQUFRO0FBQ1gsb0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELG9CQUFJLElBQUksS0FBSyxVQUFVLEVBQUUsT0FBTyx5QkFBeUIsQ0FBQyxDQUFDO0FBQzNEO0FBQUEsY0FDRjtBQUVBLG9CQUFNLEVBQUUsYUFBYSxLQUFLLElBQUksTUFBTSxPQUFPLDZFQUFlO0FBQzFELG9CQUFNLEtBQUssSUFBSSxZQUFZLEVBQUUsT0FBTyxDQUFDO0FBRXJDLG9CQUFNLGlCQUFpQjtBQUFBLGdCQUNyQixNQUFNLEtBQUs7QUFBQSxnQkFDWCxZQUFZO0FBQUEsa0JBQ1YsZUFBZSxFQUFFLE1BQU0sS0FBSyxRQUFRLGFBQWEsMEJBQTBCO0FBQUEsa0JBQzNFLE1BQU0sRUFBRSxNQUFNLEtBQUssUUFBUSxhQUFhLDZCQUE2QjtBQUFBLGtCQUNyRSxjQUFjLEVBQUUsTUFBTSxLQUFLLFFBQVEsYUFBYSwwQkFBdUI7QUFBQSxrQkFDdkUsTUFBTSxFQUFFLE1BQU0sS0FBSyxRQUFRLGFBQWEseUJBQXNCO0FBQUEsa0JBQzlELGdCQUFnQixFQUFFLE1BQU0sS0FBSyxPQUFPO0FBQUEsa0JBQ3BDLGdCQUFnQixFQUFFLE1BQU0sS0FBSyxPQUFPO0FBQUEsa0JBQ3BDLG9CQUFvQixFQUFFLE1BQU0sS0FBSyxPQUFPO0FBQUEsa0JBQ3hDLE9BQU87QUFBQSxvQkFDTCxNQUFNLEtBQUs7QUFBQSxvQkFDWCxPQUFPO0FBQUEsc0JBQ0wsTUFBTSxLQUFLO0FBQUEsc0JBQ1gsWUFBWTtBQUFBLHdCQUNWLE1BQU0sRUFBRSxNQUFNLEtBQUssT0FBTztBQUFBLHdCQUMxQixVQUFVLEVBQUUsTUFBTSxLQUFLLE9BQU87QUFBQSx3QkFDOUIsV0FBVyxFQUFFLE1BQU0sS0FBSyxPQUFPO0FBQUEsd0JBQy9CLFlBQVksRUFBRSxNQUFNLEtBQUssT0FBTztBQUFBLHNCQUNsQztBQUFBLG9CQUNGO0FBQUEsa0JBQ0Y7QUFBQSxnQkFDRjtBQUFBLGdCQUNBLFVBQVUsQ0FBQyxpQkFBaUIsUUFBUSxjQUFjO0FBQUEsY0FDcEQ7QUFFQSxvQkFBTSxTQUFTLE1BQU0sR0FBRyxPQUFPLGdCQUFnQjtBQUFBLGdCQUM3QyxPQUFPO0FBQUEsZ0JBQ1AsVUFBVTtBQUFBLGtCQUNSO0FBQUEsb0JBQ0UsT0FBTztBQUFBLHNCQUNMLEVBQUUsTUFBTSw4RUFBOEU7QUFBQSxzQkFDdEY7QUFBQSx3QkFDRSxZQUFZO0FBQUEsMEJBQ1YsVUFBVSxZQUFZO0FBQUEsMEJBQ3RCLE1BQU07QUFBQSx3QkFDUjtBQUFBLHNCQUNGO0FBQUEsb0JBQ0Y7QUFBQSxrQkFDRjtBQUFBLGdCQUNGO0FBQUEsZ0JBQ0EsUUFBUTtBQUFBLGtCQUNOLGtCQUFrQjtBQUFBLGtCQUNsQjtBQUFBLGtCQUNBLGFBQWE7QUFBQSxnQkFDZjtBQUFBLGNBQ0YsQ0FBQztBQUVELG9CQUFNLGFBQWEsT0FBTztBQUMxQixrQkFBSSxDQUFDLFlBQVk7QUFDZixzQkFBTSxJQUFJLE1BQU0sb0JBQW9CO0FBQUEsY0FDdEM7QUFFQSxrQkFBSSxZQUFZLFdBQVcsS0FBSztBQUNoQyxrQkFBSSxVQUFVLFdBQVcsS0FBSyxHQUFHO0FBQy9CLDRCQUFZLFVBQVUsUUFBUSxpQkFBaUIsRUFBRSxFQUFFLFFBQVEsV0FBVyxFQUFFLEVBQUUsS0FBSztBQUFBLGNBQ2pGO0FBRUEsa0JBQUksVUFBVSxLQUFLLEVBQUUsZ0JBQWdCLG1CQUFtQixDQUFDO0FBQ3pELGtCQUFJLElBQUksU0FBUztBQUFBLFlBQ25CLFNBQVMsT0FBWTtBQUNuQixzQkFBUSxNQUFNLGNBQWMsS0FBSztBQUNqQyxrQkFBSSxVQUFVLEtBQUssRUFBRSxnQkFBZ0IsbUJBQW1CLENBQUM7QUFDekQsa0JBQUksSUFBSSxLQUFLLFVBQVUsRUFBRSxPQUFPLG9CQUFvQixTQUFTLE1BQU0sUUFBUSxDQUFDLENBQUM7QUFBQSxZQUMvRTtBQUFBLFVBQ0YsQ0FBQztBQUFBLFFBQ0gsQ0FBQztBQUFBLE1BQ0g7QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sY0FBYztBQUFBLEVBQ2hCO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
