import { GoogleGenAI } from "@google/genai";

export const config = {
  runtime: 'edge',
};

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ScheduleContext {
  projectId: string;
  projectTitle: string;
  facilityName: string;
  date: string;
  staffNames: string[];
}

interface ChatRequest {
  message: string;
  history: ChatMessage[];
  schedules: ScheduleContext[];
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
    const { message, history, schedules } = await req.json() as ChatRequest;

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();

        const sendEvent = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // スケジュールコンテキストを構築（より詳細に）
          console.log('[chat] Received schedules:', JSON.stringify(schedules, null, 2));

          const scheduleText = schedules.map(s =>
            `- プロジェクトID: ${s.projectId}\n  タイトル: ${s.projectTitle}\n  施設: ${s.facilityName}\n  日付: ${s.date}\n  担当スタッフ: [${s.staffNames.join(', ')}]`
          ).join('\n\n');

          console.log('[chat] Schedule text for AI:', scheduleText);

          const systemPrompt = `あなたは建設プロジェクトのスケジュール管理AIアシスタントです。
ユーザーと対話しながら、スケジュールの調整を手伝います。

現在のスケジュール:
${scheduleText || '(まだスケジュールがありません)'}

以下のことができます:
1. スケジュールの説明や質問への回答
2. 日程変更の提案
3. スタッフの変更・入れ替え提案
4. 競合や問題点の指摘

回答は日本語で、簡潔に行ってください。

【重要】変更が必要な場合は、必ず以下のJSON形式で最後に出力してください:

日程変更の場合:
\`\`\`json
{"action": "reschedule", "projectId": "プロジェクトID", "newDate": "YYYY-MM-DD", "reason": "理由"}
\`\`\`

スタッフ変更の場合（特定のスタッフを外す）:
\`\`\`json
{"action": "remove_staff", "projectId": "プロジェクトID", "staffName": "外すスタッフ名", "reason": "理由"}
\`\`\`

スタッフ入れ替えの場合:
\`\`\`json
{"action": "swap_staff", "projectId": "プロジェクトID", "removeStaffName": "外すスタッフ名", "addStaffName": "追加するスタッフ名", "reason": "理由"}
\`\`\`

複数の変更が必要な場合は、配列で出力:
\`\`\`json
[{"action": "remove_staff", "projectId": "xxx", "staffName": "寺田", "reason": "理由"}, {"action": "remove_staff", "projectId": "yyy", "staffName": "太田", "reason": "理由"}]
\`\`\`

変更不要の場合:
\`\`\`json
{"action": "none"}
\`\`\`

【重要】ユーザーが「AとBを同じ現場に入れないで」のようなスタッフの組み合わせ制約を指定した場合：
1. まず現在のスケジュールで該当する箇所を探し、どちらかを外す
2. アクション実行後、今後も適用するルールとして提案する

ルール提案を含める場合のJSON形式:
\`\`\`json
{"action": "remove_staff", "projectId": "xxx", "staffName": "寺田", "reason": "AとBは同じ現場NG", "suggestRule": {"type": "no_same_project", "staffNames": ["A", "B"], "description": "AとBは同じプロジェクトに入れない"}}
\`\`\`

ユーザーがルール設定を依頼した場合（例：「○○と△△は一緒に入れないルールを作って」）は、必ずsuggestRuleを含めてください。
`;

          // 会話履歴を構築
          const conversationHistory = history.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }]
          }));

          const response = await ai.models.generateContentStream({
            model: MODEL_NAME,
            contents: [
              { role: 'user', parts: [{ text: systemPrompt }] },
              { role: 'model', parts: [{ text: 'はい、スケジュール管理のお手伝いをします。何かご質問やご要望はありますか？' }] },
              ...conversationHistory,
              { role: 'user', parts: [{ text: message }] }
            ],
            config: {
              temperature: 0.7,
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

          // アクションを抽出（配列または単一オブジェクト）
          let action = null;
          const jsonMatch = fullText.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch) {
            try {
              const parsed = JSON.parse(jsonMatch[1]);
              action = parsed;
              console.log('[chat] Parsed action:', action);
            } catch (e) {
              console.error('[chat] JSON parse error:', e);
            }
          }

          sendEvent({ type: 'complete', text: fullText, action: action });
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
