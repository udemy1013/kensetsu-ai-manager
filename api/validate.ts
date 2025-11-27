import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = 'gemini-2.5-flash';

interface AIConstraints {
  work_day?: string;
  days?: string[];
  ng_reason?: string;
  notes?: string;
}

interface ValidateRequest {
  facilityName: string;
  constraints: AIConstraints;
  newDate: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { facilityName, constraints, newDate } = req.body as ValidateRequest;

    const prompt = `
      You are a strict construction site supervisor.
      A user is trying to move a schedule for the facility: "${facilityName}".

      Target Date: ${newDate}

      Facility Constraints:
      ${JSON.stringify(constraints, null, 2)}

      Task:
      Check if the "Target Date" violates any "Facility Constraints" (like closed days, specific allowed days of week).

      Output JSON:
      {
        "valid": boolean,
        "message": "Short warning message in Japanese if invalid, or 'OK' if valid.",
        "severity": "warning" | "error" | "info"
      }
    `;

    const responseSchema: Schema = {
      type: Type.OBJECT,
      properties: {
        valid: { type: Type.BOOLEAN },
        message: { type: Type.STRING, description: "Message in Japanese" },
        severity: { type: Type.STRING, enum: ["warning", "error", "info"] }
      }
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(200).json({ valid: true });
    }

    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Validation Error:", error);
    return res.status(200).json({ valid: true }); // Default to allow if AI fails
  }
}
