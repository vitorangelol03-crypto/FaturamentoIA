import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { GEMINI_API_KEY } from '../constants';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

// Schema definitions using the stable SDK format
const receiptSchema = {
  type: SchemaType.OBJECT,
  properties: {
    establishment: { type: SchemaType.STRING, description: "Name of the store or merchant" },
    date: { type: SchemaType.STRING, description: "Date of purchase in YYYY-MM-DD format" },
    total_amount: { type: SchemaType.NUMBER, description: "Total numeric value of the receipt" },
    cnpj: { type: SchemaType.STRING, description: "CNPJ of the merchant if available" },
    payment_method: { type: SchemaType.STRING, description: "Payment method (Credit, Debit, Cash, Pix)" },
    receipt_number: { type: SchemaType.STRING, description: "Invoice or receipt number" },
    suggested_category: { type: SchemaType.STRING, description: "One of: Alimentação, Transporte, Saúde, Moradia, Lazer, Educação, Vestuário, Outros" },
    items: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.NUMBER },
          unitPrice: { type: SchemaType.NUMBER },
          totalPrice: { type: SchemaType.NUMBER }
        }
      }
    }
  },
  required: ["establishment", "date", "total_amount", "suggested_category"]
};

export async function extractReceiptData(base64Image: string, mimeType: string = 'image/jpeg') {
  try {
    const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, "");

    // Use gemini-1.5-flash as it is the current stable standard for this SDK
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: receiptSchema,
        temperature: 0.1, // Low temperature for factual extraction
      }
    });

    const prompt = "Analyze this receipt image and extract the following data. Ensure the date is YYYY-MM-DD. If items are unclear, summarize them.";

    const result = await model.generateContent([
        prompt, 
        {
            inlineData: {
                data: cleanBase64,
                mimeType: mimeType
            }
        }
    ]);

    const response = await result.response;
    const jsonText = response.text();

    if (!jsonText) throw new Error("No data returned from AI");

    return JSON.parse(jsonText);
  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw error;
  }
}