import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type, Schema } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_NAME = 'gemini-3-pro-preview';

interface ProjectContext {
  id: string;
  facilityName: string;
  constraints: {
    work_day?: string;
    days?: string[];
    ng_reason?: string;
    notes?: string;
  };
  headcount: number;
}

interface ScheduleRequest {
  projects: ProjectContext[];
  targetMonth: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { projects, targetMonth } = req.body as ScheduleRequest;

    if (!projects || projects.length === 0) {
      return res.status(200).json([]);
    }

    const prompt = `
      You are an expert construction scheduler.
      Target Month: ${targetMonth} (Year-Month).

      Task: Assign a valid specific date (YYYY-MM-DD) within the target month for each project.

      Rules:
      1. Respect the 'constraints' field strictly (e.g., if days=['Mon', 'Tue'], only pick a Monday or Tuesday in that month).
      2. Distribute the work evenly if possible, avoiding putting everything on the 1st of the month.
      3. Return a JSON array.
      4. **IMPORTANT: The 'reason' field must be written in Japanese.**

      Projects to schedule:
      ${JSON.stringify(projects, null, 2)}
    `;

    const responseSchema: Schema = {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          projectId: { type: Type.STRING },
          recommendedDate: { type: Type.STRING, description: "YYYY-MM-DD format" },
          reason: { type: Type.STRING, description: "Short explanation in Japanese why this date was chosen." }
        },
        required: ["projectId", "recommendedDate", "reason"]
      }
    };

    const response = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1
      }
    });

    const text = response.text;
    if (!text) {
      return res.status(200).json([]);
    }

    const result = JSON.parse(text);
    return res.status(200).json(result);
  } catch (error) {
    console.error("AI Auto-Assign Error:", error);
    return res.status(500).json({ error: 'AI scheduling failed' });
  }
}
