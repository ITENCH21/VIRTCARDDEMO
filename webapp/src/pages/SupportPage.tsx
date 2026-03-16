import { useState, useRef, useEffect } from 'react';
import { SendIcon, QuestionMarkIcon, MessageIcon, ExternalLinkIcon } from '../components/icons';

interface ChatMessage {
  id: number;
  text: string;
  isUser: boolean;
  timestamp: string;
}

export default function SupportPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      text: 'Здравствуйте! Как мы можем вам помочь?',
      isUser: false,
      timestamp: '14:30',
    },
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const faqItems = [
    { question: 'Как пополнить счет?', answer: 'Перейдите в раздел "Пополнение" и отправьте USDT на указанный адрес.' },
    { question: 'Какие лимиты на вывод?', answer: 'Минимальный вывод: 10 USDT, максимальный: 50,000 USDT в сутки.' },
    { question: 'Сколько времени идет обработка?', answer: 'Обычно 5-15 минут. В пиковые часы может быть дольше.' },
    { question: 'Как открыть виртуальную карту?', answer: 'Нажмите "Выпустить карту" в разделе Карты и выберите тип.' },
  ];

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    // Add user message
    const userMessage: ChatMessage = {
      id: messages.length + 1,
      text: input,
      isUser: true,
      timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Simulate support response
    setTimeout(() => {
      const responses = [
        'Спасибо за ваш вопрос! Я посмотрю в нашей базе знаний...',
        'Поняли вашу проблему. Это частый вопрос.',
        'Давайте разберемся пошагово.',
        'Отлично, помогу вам с этим!',
      ];

      const supportMessage: ChatMessage = {
        id: messages.length + 2,
        text: responses[Math.floor(Math.random() * responses.length)],
        isUser: false,
        timestamp: new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages(prev => [...prev, supportMessage]);
      setLoading(false);
    }, 800);
  };

  const handleFAQClick = (question: string) => {
    setInput(question);
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: 0 }}>
      {/* Header */}
      <div style={{
        padding: '20px 16px', borderBottom: '1px solid var(--border-glass)',
        background: 'var(--bg-glass)',
      }}>
        <h1 className="page-title" style={{ margin: 0, marginBottom: 8 }}>
          Поддержка
        </h1>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          fontSize: 12, color: 'var(--text-muted)',
        }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          Агент в сети
        </div>
      </div>

      {/* FAQ Quick Links */}
      <div style={{
        padding: '12px 16px', borderBottom: '1px solid var(--border-glass)',
        overflowX: 'auto', display: 'flex', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {faqItems.slice(0, 2).map((item, idx) => (
            <button
              key={idx}
              onClick={() => handleFAQClick(item.question)}
              style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 500,
                background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)', cursor: 'pointer',
                color: 'var(--text-secondary)', transition: 'var(--transition-normal)',
                whiteSpace: 'nowrap',
              }}
            >
              {item.question.slice(0, 20)}...
            </button>
          ))}
          <button
            style={{
              padding: '6px 12px', fontSize: 11, fontWeight: 500,
              background: 'var(--bg-glass)', border: '1px solid var(--border-glass)',
              borderRadius: 'var(--radius-md)', cursor: 'pointer',
              color: 'var(--accent-1)', transition: 'var(--transition-normal)',
            }}
          >
            <QuestionMarkIcon size={14} style={{ display: 'inline', marginRight: 4 }} />
            Еще
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div style={{
        flex: 1, overflowY: 'auto', padding: '16px',
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: 'flex', justifyContent: msg.isUser ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              style={{
                maxWidth: '80%', padding: '12px 14px',
                background: msg.isUser ? 'var(--accent-1)' : 'var(--bg-glass)',
                border: msg.isUser ? 'none' : '1px solid var(--border-glass)',
                borderRadius: 'var(--radius-md)',
                borderTopLeftRadius: msg.isUser ? 'var(--radius-md)' : 0,
                borderTopRightRadius: msg.isUser ? 0 : 'var(--radius-md)',
                color: msg.isUser ? '#fff' : 'var(--text-primary)',
                fontSize: 13, lineHeight: 1.5,
                wordBreak: 'break-word',
              }}
            >
              {msg.text}
              <div
                style={{
                  fontSize: 10,
                  color: msg.isUser ? 'rgba(255,255,255,0.7)' : 'var(--text-muted)',
                  marginTop: 4,
                }}
              >
                {msg.timestamp}
              </div>
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--text-muted)', opacity: 0.4,
                animation: 'pulse 1.5s infinite',
              }}
            />
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--text-muted)', opacity: 0.6,
                animation: 'pulse 1.5s infinite 0.2s',
              }}
            />
            <div
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--text-muted)',
                animation: 'pulse 1.5s infinite 0.4s',
              }}
            />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid var(--border-glass)',
        background: 'var(--bg-glass)',
      }}>
        <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Напишите сообщение..."
            className="form-input"
            style={{ flex: 1 }}
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="btn btn-primary"
            style={{
              padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: loading || !input.trim() ? 0.5 : 1,
              cursor: loading || !input.trim() ? 'default' : 'pointer',
            }}
          >
            <SendIcon size={18} />
          </button>
        </form>
      </div>

      {/* Contact Info */}
      <div style={{
        padding: '14px 16px', borderTop: '1px solid var(--border-glass)',
        background: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(99,102,241,0.05) 100%)',
        fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center',
      }}>
        <div style={{ marginBottom: 8 }}>
          💬 Также вы можете написать нам в <strong>Telegram</strong>:
        </div>
        <a
          href="https://t.me/virtcardpay_support"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            color: 'var(--accent-1)', fontWeight: 600, textDecoration: 'none',
          }}
        >
          @virtcardpay_support
          <ExternalLinkIcon size={12} />
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
