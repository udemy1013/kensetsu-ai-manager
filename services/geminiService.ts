import { Facility, Project, ValidationResult } from '../types';

// ストリーミングイベントの型
export interface StreamEvent {
  type: 'start' | 'chunk' | 'complete' | 'error';
  message?: string;
  text?: string;
  accumulated?: string;
  data?: { projectId: string; recommendedDate: string; reason: string }[];
}

// タイムアウト付きfetch
const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs: number = 30000): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
};

// エラー型を定義
export interface AIServiceResult<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

/**
 * AI Agent to automatically assign dates to projects based on facility constraints.
 * Calls server-side API to keep API key secure.
 */
export const autoAssignSchedule = async (
  projects: Project[],
  facilities: Facility[],
  targetMonth: string // "YYYY-MM"
): Promise<AIServiceResult<{ projectId: string; recommendedDate: string; reason: string }[]>> => {

  if (projects.length === 0) return { data: [], error: null, success: true };

  // Prepare context for the API
  const projectsContext = projects.map(p => ({
    id: p.id,
    facilityName: facilities.find(f => f.id === p.facility_id)?.name,
    constraints: facilities.find(f => f.id === p.facility_id)?.ai_constraints,
    headcount: p.required_headcount
  }));

  try {
    const response = await fetchWithTimeout('/api/schedule', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projects: projectsContext,
        targetMonth
      })
    }, 30000); // 30秒タイムアウト

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error("API Error:", errorText);
      return {
        data: null,
        error: `APIエラー: ${response.status} - ${errorText}`,
        success: false
      };
    }

    const data = await response.json();
    return { data, error: null, success: true };
  } catch (error) {
    console.error("AI Auto-Assign Error:", error);

    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { data: null, error: 'タイムアウト: AIの応答に時間がかかりすぎています。再試行してください。', success: false };
      }
      return { data: null, error: `エラー: ${error.message}`, success: false };
    }
    return { data: null, error: '不明なエラーが発生しました', success: false };
  }
};

/**
 * AI Agent to validate a schedule move.
 * Checks if the new date conflicts with facility constraints.
 * Calls server-side API to keep API key secure.
 */
export const validateScheduleMove = async (
  facility: Facility,
  newDate: string,
  staffIds: string[] = []
): Promise<ValidationResult> => {

  try {
    const response = await fetchWithTimeout('/api/validate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        facilityName: facility.name,
        constraints: facility.ai_constraints,
        newDate
      })
    }, 15000); // 15秒タイムアウト

    if (!response.ok) {
      console.error("API Error:", response.statusText);
      return { valid: true };
    }

    return await response.json();
  } catch (error) {
    console.error("AI Validation Error:", error);
    // タイムアウトやエラー時はvalidとして通す（UXを優先）
    return { valid: true };
  }
};

/**
 * AI Agent with streaming support.
 * Streams the AI response in real-time via Server-Sent Events.
 */
export const autoAssignScheduleStream = async (
  projects: Project[],
  facilities: Facility[],
  targetMonth: string,
  customRules: string[],
  onEvent: (event: StreamEvent) => void
): Promise<{ projectId: string; recommendedDate: string; reason: string }[]> => {

  if (projects.length === 0) {
    onEvent({ type: 'complete', data: [] });
    return [];
  }

  // Prepare context for the API
  const projectsContext = projects.map(p => ({
    id: p.id,
    facilityName: facilities.find(f => f.id === p.facility_id)?.name,
    constraints: facilities.find(f => f.id === p.facility_id)?.ai_constraints,
    headcount: p.required_headcount
  }));

  try {
    console.log('[geminiService] Calling /api/schedule-stream...');
    onEvent({ type: 'start', message: 'APIを呼び出し中...' });

    const response = await fetch('/api/schedule-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        projects: projectsContext,
        targetMonth,
        customRules
      })
    });

    console.log('[geminiService] Response status:', response.status);

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      console.error('[geminiService] API Error:', errorText);
      onEvent({ type: 'error', message: `APIエラー: ${response.status} - ${errorText}` });
      return [];
    }

    const reader = response.body?.getReader();
    console.log('[geminiService] Got reader:', !!reader);
    if (!reader) {
      onEvent({ type: 'error', message: 'ストリームを読み取れません' });
      return [];
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let result: { projectId: string; recommendedDate: string; reason: string }[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log('[geminiService] Stream done');
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log('[geminiService] Received chunk:', chunk.substring(0, 100));
      buffer += chunk;

      // SSEイベントをパース
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 最後の不完全な行を保持

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const event: StreamEvent = JSON.parse(line.slice(6));
            console.log('[geminiService] Parsed event:', event.type);
            onEvent(event);

            if (event.type === 'complete' && event.data) {
              result = event.data;
            }
          } catch (e) {
            console.error('[geminiService] Parse error:', e);
          }
        }
      }
    }

    return result;
  } catch (error) {
    console.error("AI Streaming Error:", error);
    onEvent({ type: 'error', message: `エラー: ${error instanceof Error ? error.message : '不明なエラー'}` });
    return [];
  }
};
