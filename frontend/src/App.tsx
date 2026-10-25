import { useState, useRef, useEffect } from 'react';
import { adkService, ChatMessage } from './services/adkService';
import { A2UIRenderer } from './components/A2UIRenderer';
import { MarkdownRenderer } from './components/MarkdownRenderer';
import { Send, UtensilsCrossed, Loader2, RefreshCw, Sparkles, ChefHat } from 'lucide-react';

export default function App() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'agent',
      text: "👋 Hi! I'm your AI Recipe Assistant powered by ADK and A2UI. Ask me for dinner ideas, spicy dishes, or healthy meals to see dynamic UI cards!",
    },
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (textToSend?: string) => {
    const query = textToSend || input;
    if (!query.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: query,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const botMsg = await adkService.sendMessage(query);
      setMessages((prev) => [...prev, botMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'agent',
          text: `⚠️ Error connecting to ADK agent: ${err.message}.\nMake sure the ADK server is running: \`.venv/bin/adk web --port 8080 --allow_origins "*"\``,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = (action: { type: string; parameters?: Record<string, any>; context?: Record<string, any> }) => {
    const params = action.context || action.parameters || {};
    if (action.type === 'view_recipe') {
      handleSend(`Please show me the full recipe details and ingredients for ${params.recipe_name}.`);
      return;
    }
    if (action.type === 'start_cooking') {
      handleSend(`Let's cook the ${params.recipe_name}. Guide me with the cooking steps!`);
      return;
    }
    if (action.type === 'next_step') {
      // Steps advance locally in the card; do not call agent
      return;
    }
    if (action.type === 'finish_cooking') {
      handleSend(`I've completed all cooking steps for ${params.recipe_name || 'this dish'}! How should I plate and serve it?`);
      return;
    }
    const actionPrompt = params.recipe_name
      ? `Let's cook the ${params.recipe_name}. Guide me step by step!`
      : `I selected action: ${action.type}`;
    handleSend(actionPrompt);
  };

  const samplePrompts = [
    'What can I make for dinner tonight?',
    'Show me quick spicy recipes',
    'How do I cook the Carbonara pasta?',
    'Do you have healthy vegetarian options?',
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-800 antialiased">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
            <UtensilsCrossed size={20} />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight flex items-center gap-2">
              ADK + A2UI Recipe Assistant
              <span className="text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full uppercase tracking-wider">
                React Client
              </span>
            </h1>
            <p className="text-xs text-slate-500">
              Direct connection to ADK Agent via Agent-to-User Interface (A2UI)
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setMessages([
              {
                id: `welcome-${Date.now()}`,
                sender: 'agent',
                text: "✨ Reset session. What would you like to cook today?",
              },
            ]);
          }}
          title="Clear Chat"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition"
        >
          <RefreshCw size={18} />
        </button>
      </header>

      {/* Main Chat Thread */}
      <main className="flex-1 overflow-y-auto px-4 py-6 max-w-3xl w-full mx-auto space-y-5">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex items-start gap-3 ${
              msg.sender === 'user' ? 'justify-end' : 'justify-start'
            }`}
          >
            {msg.sender === 'agent' && (
              <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5">
                <ChefHat size={18} />
              </div>
            )}

            <div
              className={`rounded-2xl p-4 transition-all ${
                msg.sender === 'user'
                  ? 'bg-emerald-600 text-white shadow-sm max-w-[80%] rounded-tr-none'
                  : 'bg-white border border-slate-200/90 text-slate-800 shadow-sm w-full max-w-2xl rounded-tl-none'
              }`}
            >
              {msg.text && (
                msg.sender === 'user' ? (
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {msg.text}
                  </div>
                ) : (
                  <MarkdownRenderer content={msg.text} />
                )
              )}

              {msg.surfaceState && (
                <div className={`${msg.text ? 'mt-3 pt-3 border-t border-slate-100' : ''}`}>
                  <A2UIRenderer surface={msg.surfaceState} onAction={handleAction} />
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2.5 text-slate-400 text-xs pl-11">
            <Loader2 className="animate-spin text-emerald-600" size={16} />
            <span>ADK agent is generating recipe UI...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Footer Suggestions & Input */}
      <footer className="bg-white border-t border-slate-200/80 p-4 sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto space-y-3">
          {/* Quick chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
            <span className="text-slate-400 font-medium shrink-0 flex items-center gap-1">
              <Sparkles size={12} /> Try:
            </span>
            {samplePrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-full shrink-0 transition"
              >
                {prompt}
              </button>
            ))}
          </div>

          {/* Input field */}
          <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-2xl px-4 py-1.5 focus-within:ring-2 focus-within:ring-emerald-500 focus-within:bg-white transition">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Ask about recipes, ingredients, cooking steps..."
              className="flex-1 bg-transparent py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
            />
            <button
              onClick={() => handleSend()}
              disabled={loading || !input.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white p-2.5 rounded-xl transition shadow-sm"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
