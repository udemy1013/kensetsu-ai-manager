import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, ArrowLeft, ShieldCheck, X } from 'lucide-react';

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

interface ChatAction {
  action: string;
  projectId?: string;
  newDate?: string;
  staffName?: string;
  removeStaffName?: string;
  addStaffName?: string;
  reason?: string;
}

interface PendingRule {
  type: string;
  staffNames: string[];
  description: string;
}

interface ChatPanelProps {
  schedules: ScheduleContext[];
  onAction: (action: ChatAction | ChatAction[]) => void;
  onBackToList: () => void;
  pendingRule?: PendingRule | null;
  onSaveRule?: (rule: PendingRule) => void;
  onDismissRule?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  schedules,
  onAction,
  onBackToList,
  pendingRule,
  onSaveRule,
  onDismissRule
}) => {
  // デバッグ: 受け取ったスケジュールを確認
  console.log('[ChatPanel] Received schedules:', schedules);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'スケジュールの自動アサインが完了しました！\n\n何か調整したい点があれば、お気軽にご相談ください。例えば:\n- 「○○の日程を変更したい」\n- 「来週の予定を確認したい」\n- 「スタッフの負荷を見せて」'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setStreamingText('');

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages,
          schedules: schedules
        })
      });

      if (!response.ok) {
        throw new Error('API error');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No reader');

      const decoder = new TextDecoder();
      let buffer = '';
      let fullText = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === 'chunk') {
                fullText = event.accumulated || '';
                // JSONブロックを除いて表示
                const displayText = fullText.replace(/```json[\s\S]*?```/g, '').trim();
                setStreamingText(displayText);
              }

              if (event.type === 'complete') {
                const displayText = (event.text || '').replace(/```json[\s\S]*?```/g, '').trim();
                setMessages(prev => [...prev, { role: 'assistant', content: displayText }]);
                setStreamingText('');

                // アクションがあれば実行（配列または単一オブジェクト）
                if (event.action) {
                  if (Array.isArray(event.action)) {
                    // 配列の場合、各アクションを処理
                    const validActions = event.action.filter((a: ChatAction) => a.action !== 'none');
                    if (validActions.length > 0) {
                      onAction(validActions);
                    }
                  } else if (event.action.action !== 'none') {
                    onAction(event.action);
                  }
                }
              }

              if (event.type === 'error') {
                setMessages(prev => [...prev, { role: 'assistant', content: `エラー: ${event.message}` }]);
                setStreamingText('');
              }
            } catch (e) {
              // パースエラーは無視
            }
          }
        }
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。もう一度お試しください。' }]);
      setStreamingText('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="w-80 bg-white rounded-lg shadow-sm border border-gray-200 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-800 text-sm">AIアシスタント</h3>
              <p className="text-[10px] text-gray-500">スケジュール調整をサポート</p>
            </div>
          </div>
          <button
            onClick={onBackToList}
            className="text-gray-400 hover:text-gray-600 p-1 rounded hover:bg-gray-100"
            title="案件一覧に戻る"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
              msg.role === 'user' ? 'bg-indigo-100' : 'bg-gray-100'
            }`}>
              {msg.role === 'user' ? (
                <User className="w-3 h-3 text-indigo-600" />
              ) : (
                <Bot className="w-3 h-3 text-gray-600" />
              )}
            </div>
            <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-800'
            }`}>
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {streamingText && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-gray-100">
              <Bot className="w-3 h-3 text-gray-600" />
            </div>
            <div className="max-w-[85%] rounded-lg px-3 py-2 text-sm bg-gray-100 text-gray-800">
              <p className="whitespace-pre-wrap">{streamingText}</p>
              <span className="animate-pulse">|</span>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingText && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 bg-gray-100">
              <Bot className="w-3 h-3 text-gray-600" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ルール保存確認バナー */}
      {pendingRule && onSaveRule && onDismissRule && (
        <div className="mx-3 mb-2 p-3 bg-gradient-to-r from-purple-50 to-indigo-50 rounded-lg border border-purple-200 shadow-sm">
          <div className="flex items-start gap-2">
            <ShieldCheck className="w-5 h-5 text-purple-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-purple-800">ルールとして保存しますか？</h4>
              <p className="text-xs text-purple-600 mt-1">{pendingRule.description}</p>
              <p className="text-[10px] text-gray-500 mt-1">
                このルールを保存すると、今後の自動アサインでも適用されます
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => onSaveRule(pendingRule)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-md hover:bg-purple-700 transition-colors"
                >
                  <ShieldCheck className="w-3 h-3" />
                  保存する
                </button>
                <button
                  onClick={onDismissRule}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-md hover:bg-gray-200 transition-colors"
                >
                  <X className="w-3 h-3" />
                  今回だけ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t border-gray-200 bg-gray-50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="メッセージを入力..."
            disabled={isLoading}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
            className="px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1 text-center">
          Enter で送信 / Shift+Enter で改行
        </p>
      </div>
    </div>
  );
};

export default ChatPanel;
