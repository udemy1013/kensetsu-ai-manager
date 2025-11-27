import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge', // Edge Runtimeを使用
};

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
  customRules?: string[];
}

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const ai = new GoogleGenAI({ apiKey });
  const MODEL_NAME = 'gemini-2.5-flash';

  try {
    const { projects, targetMonth, customRules } = await req.json() as ScheduleRequest;

    // ReadableStreamを作成
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          sendEvent({ type: 'start', message: '接続しました。AI分析を準備中...' });

          if (!projects || projects.length === 0) {
            sendEvent({ type: 'complete', data: [] });
            controller.close();
            return;
          }

          sendEvent({ type: 'start', message: `${projects.length}件のプロジェクトを分析中...` });

          // カスタムルールセクションを生成
          const customRulesSection = customRules && customRules.length > 0
            ? `
            【重要】以下のカスタムルールを必ず考慮してください:
            ${customRules.map((rule, i) => `${i + 1}. ${rule}`).join('\n            ')}

            これらのルールに違反する日程や配置は絶対に行わないでください。
            `
            : '';

          const prompt = `
            You are an expert construction scheduler.
            Target Month: ${targetMonth} (Year-Month).

            Task: Assign a valid specific date (YYYY-MM-DD) within the target month for each project.

            Rules:
            1. Respect the 'constraints' field strictly (e.g., if days=['Mon', 'Tue'], only pick a Monday or Tuesday in that month).
            2. Distribute the work evenly if possible, avoiding putting everything on the 1st of the month.
            3. Return a JSON array with objects containing: projectId, recommendedDate (YYYY-MM-DD), reason (in Japanese).
            4. **IMPORTANT: The 'reason' field must be written in Japanese.**
            ${customRulesSection}
            Projects to schedule:
            ${JSON.stringify(projects, null, 2)}

            Output ONLY the JSON array, no other text.
          `;

          sendEvent({ type: 'start', message: 'Gemini APIに接続中...' });

          const response = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: prompt,
            config: {
              temperature: 0.1,
              thinkingConfig: { thinkingBudget: 0 }
            }
          });

          let fullText = '';

          for await (const chunk of response) {
            const text = chunk.text || '';
            if (text) {
              fullText += text;
              sendEvent({ type: 'chunk', text: text, accumulated: fullText });
            }
          }

          // JSONをパース
          let result = [];
          try {
            let jsonText = fullText.trim();
            if (jsonText.startsWith('```json')) {
              jsonText = jsonText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (jsonText.startsWith('```')) {
              jsonText = jsonText.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            result = JSON.parse(jsonText);
          } catch (parseError) {
            sendEvent({ type: 'error', message: 'JSONパースエラー: ' + String(parseError) });
          }

          sendEvent({ type: 'complete', data: result });
          controller.close();

        } catch (error) {
          sendEvent({ type: 'error', message: 'AIエラー: ' + String(error) });
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
      }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Request parsing failed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
