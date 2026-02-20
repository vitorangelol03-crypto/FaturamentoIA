
import { GoogleGenAI, Type } from "@google/genai";

const VALID_CATEGORIES = [
  "Alimentação",
  "Transporte",
  "Saúde",
  "Moradia",
  "Lazer",
  "Educação",
  "Vestuário",
  "Tecnologia",
  "Serviços",
  "Agropecuária",
  "Outros"
];

const EXTRACTION_PROMPT = `Você é um especialista em leitura de notas fiscais brasileiras (NFC-e, NF-e, cupons fiscais).

TAREFA: Extraia TODOS os dados desta nota fiscal com máxima precisão.

REGRAS DE CATEGORIZAÇÃO (IMPORTANTE):
- A categoria deve ser baseada nos ITENS COMPRADOS, NÃO no nome do estabelecimento.
- Exemplos:
  • Posto de combustível vendendo COMBUSTÍVEL (gasolina, etanol, diesel) → "Transporte"
  • Posto de combustível vendendo FLUIDO DE FREIO, óleo, peças → "Transporte"
  • Posto de combustível vendendo ÁGUA, refrigerante, salgado → "Alimentação"
  • Supermercado vendendo ALIMENTOS → "Alimentação"
  • Supermercado vendendo PRODUTOS DE LIMPEZA → "Moradia"
  • Supermercado vendendo RAÇÃO ANIMAL → "Agropecuária"
  • Farmácia vendendo MEDICAMENTOS → "Saúde"
  • Farmácia vendendo CHOCOLATES, BISCOITOS → "Alimentação"
  • Loja vendendo CELULAR, COMPUTADOR → "Tecnologia"
  • Loja vendendo ROUPAS, CALÇADOS → "Vestuário"
  • Oficina mecânica, borracharia, autopeças, retífica, funilaria → "Transporte"
  • Serviço de recuperação de pneu, câmara, alinhamento, balanceamento → "Transporte"
  • Troca de óleo, filtro, pastilha de freio, correia, amortecedor → "Transporte"
  • Qualquer serviço ou peça AUTOMOTIVA/VEICULAR → "Transporte"
  • Materiais de construção → "Moradia"
  • Insumos agrícolas, fertilizantes, sementes → "Agropecuária"

CATEGORIAS VÁLIDAS: ${VALID_CATEGORIES.join(", ")}

ATENÇÃO ESPECIAL:
- Se o nome do estabelecimento contém "MECÂNICA", "BORRACHARIA", "AUTOPEÇAS", "RETÍFICA", "FUNILARIA", "AUTO CENTER", "AUTO ELÉTRICA", a categoria DEVE ser "Transporte"
- Serviços como "recuperação de câmara", "troca de pneu", "alinhamento", "balanceamento" são SEMPRE "Transporte"

Se a nota tiver itens de categorias diferentes, escolha a categoria do item de MAIOR VALOR.

REGRAS DE EXTRAÇÃO:
1. ESTABLISHMENT: Nome comercial/fantasia do estabelecimento (não a razão social completa, a menos que seja o único disponível)
2. DATE: Data da emissão no formato YYYY-MM-DD (para cupons fiscais simples sem vencimento, esta é a data principal)
3. ISSUE_DATE: Data de EMISSÃO / COMPETÊNCIA / REFERÊNCIA do documento no formato YYYY-MM-DD. Para contas de serviço (luz, água, internet, telefone), é a data de emissão ou o mês de referência (usar primeiro dia do mês). Para cupons fiscais de compra, é a mesma data da compra. Se não encontrar, retorne string vazia.
4. DUE_DATE: Data de VENCIMENTO do documento no formato YYYY-MM-DD. Para contas de serviço (luz, água, internet, telefone), boletos e faturas que têm prazo de pagamento. Para cupons fiscais de compra normal (sem vencimento), retorne string vazia.
5. TOTAL_AMOUNT: Valor TOTAL da nota (campo "Valor total" ou "TOTAL R$"), apenas o número
6. CNPJ: CNPJ do EMITENTE (vendedor), apenas números sem pontuação (14 dígitos)
7. ACCESS_KEY: Chave de acesso da NF-e com EXATAMENTE 44 dígitos numéricos. Geralmente aparece:
   - No rodapé da nota
   - Próximo ao QR Code
   - Após "Chave de Acesso" ou "Consulte pela Chave de Acesso"
   - Pode estar separada em grupos de 4 dígitos
   IMPORTANTE: Junte todos os dígitos em uma string contínua de 44 números. Se não encontrar exatamente 44 dígitos, retorne string vazia.
8. ITEMS: Lista de produtos/serviços com nome, quantidade, preço unitário e preço total
9. PAYMENT_METHOD: Forma de pagamento (Dinheiro, Cartão de Crédito, Cartão de Débito, PIX, etc.)
10. RECEIPT_NUMBER: Número da nota fiscal

VALIDAÇÃO DA IMAGEM:
- Se a imagem NÃO for uma nota fiscal, cupom fiscal ou recibo, retorne readable = false
- Se a imagem estiver muito borrada, cortada ou ilegível, retorne readable = false
- Se conseguir extrair pelo menos estabelecimento + valor total, retorne readable = true

Retorne APENAS o JSON estruturado.`;

export default async function handler(req, res) {
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

  const { image, mimeType, images } = req.body;
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Configuração: API_KEY não encontrada.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        readable: { type: Type.BOOLEAN, description: "true se a imagem é uma nota fiscal legível, false se não for nota fiscal ou estiver ilegível" },
        establishment: { type: Type.STRING, description: "Nome do estabelecimento" },
        date: { type: Type.STRING, description: "Data da compra/emissão no formato YYYY-MM-DD" },
        issue_date: { type: Type.STRING, description: "Data de emissão/competência no formato YYYY-MM-DD, ou string vazia se não aplicável" },
        due_date: { type: Type.STRING, description: "Data de vencimento no formato YYYY-MM-DD, ou string vazia se não aplicável" },
        total_amount: { type: Type.NUMBER, description: "Valor total numérico" },
        cnpj: { type: Type.STRING, description: "CNPJ do emitente, apenas 14 dígitos numéricos" },
        receipt_number: { type: Type.STRING, description: "Número da nota fiscal" },
        payment_method: { type: Type.STRING, description: "Forma de pagamento" },
        suggested_category: { type: Type.STRING, description: `Categoria baseada nos ITENS comprados. Valores: ${VALID_CATEGORIES.join(", ")}` },
        access_key: { type: Type.STRING, description: "Chave de acesso NF-e com exatamente 44 dígitos numéricos contínuos, ou string vazia se não encontrada" },
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
      required: ["readable", "establishment", "date", "total_amount", "suggested_category"]
    };

    const parts = [
      { text: EXTRACTION_PROMPT },
      {
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: image
        }
      }
    ];

    if (images && Array.isArray(images)) {
      for (const img of images) {
        parts.push({
          inlineData: {
            mimeType: img.mimeType || 'image/jpeg',
            data: img.data
          }
        });
      }
    }

    const result = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [
        {
          parts
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
      return res.status(200).json({ readable: false, error: "Resposta vazia da IA" });
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
      }
    }

    if (!VALID_CATEGORIES.includes(parsed.suggested_category)) {
      parsed.suggested_category = 'Outros';
    }

    return res.status(200).json(parsed);

  } catch (error) {
    console.error("Erro na API de extração:", error);
    return res.status(500).json({ 
      readable: false,
      error: 'Erro interno no processamento', 
      details: error.message 
    });
  }
}
