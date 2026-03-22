import { GoogleGenAI } from "@google/genai";
import { Invoice } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const geminiService = {
  summarizeSales: async (invoices: Invoice[]) => {
    if (invoices.length === 0) return "No sales data available to summarize.";

    const prompt = `
      As a business analyst, summarize the following sales data from recent invoices.
      Provide insights on:
      1. Total revenue and average order value.
      2. Most popular items (by quantity and revenue).
      3. Any notable trends or suggestions for the business.

      Sales Data:
      ${JSON.stringify(invoices.map(inv => ({
        date: inv.date,
        total: inv.total,
        items: inv.items.map(item => ({ name: item.name, qty: item.quantity, price: item.price }))
      })), null, 2)}

      Format the response in clean Markdown.
    `;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.0-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });
      return response.text || "Failed to generate summary.";
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Error generating AI summary. Please check your API key.";
    }
  }
};
