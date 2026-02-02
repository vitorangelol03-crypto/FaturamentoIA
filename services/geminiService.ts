import { GoogleGenAI, Type } from "@google/genai";
import { GEMINI_API_KEY } from '../constants';

const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Schema for Receipt Extraction
const receiptSchema = {
  type: Type.OBJECT,
  properties: {
    establishment: { type: Type.STRING, description: "Name of the store or merchant" },
    date: { type: Type.STRING, description: "Date of purchase in YYYY-MM-DD format" },
    total_amount: { type: Type.NUMBER, description: "Total numeric value of the receipt" },
    cnpj: { type: Type.STRING, description: "CNPJ of the merchant if available" },
    payment_method: { type: Type.STRING, description: "Payment method (Credit, Debit, Cash, Pix)" },
    receipt_number: { type: Type.STRING, description: "Invoice or receipt number" },
    suggested_category: { type: Type.STRING, description: "One of: Alimentação, Transporte, Saúde, Moradia, Lazer, Educação, Vestuário, Outros" },
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
  required: ["establishment", "date", "total_amount", "suggested_category"]
};

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: {
        parts: [
          { inlineData: { mimeType: mimeType, data: cleanBase64 } },
          { text: "Analyze this receipt image and extract the following data. Ensure the date is YYYY-MM-DD. If items are unclear, summarize them." }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const jsonText = response.text;
    if (!jsonText) throw new Error("No data returned from AI");

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}
