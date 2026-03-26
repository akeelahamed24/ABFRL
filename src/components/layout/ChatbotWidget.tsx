import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, History, MessageCircle, Send, Sparkles, User as UserIcon } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { chatAPI, ChatSessionSummary, salesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

const SESSION_KEY = 'sales_chat_session_id';

const STARTER_PROMPTS = [
  'Recommend an outfit for a wedding',
  'Show me men\'s formal wear',
  'What products are available under 3000?',
];

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi, I am your ABFRL shopping assistant. Ask for outfit ideas, stock help, offers, checkout guidance, or order support.',
};

export const ChatbotWidget = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { openCart } = useCart();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recentSessions, setRecentSessions] = useState<ChatSessionSummary[]>([]);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const sessionStorageKey = useMemo(
    () => (isAuthenticated && user?.id ? `${SESSION_KEY}:${user.id}` : `${SESSION_KEY}:guest`),
    [isAuthenticated, user?.id]
  );

  useEffect(() => {
    const savedSessionId = localStorage.getItem(sessionStorageKey);
    setSessionId(savedSessionId || null);
    setMessages([initialMessage]);
    setInput('');
  }, [sessionStorageKey]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(sessionStorageKey, sessionId);
      return;
    }

    localStorage.removeItem(sessionStorageKey);
  }, [sessionId, sessionStorageKey]);

  useEffect(() => {
    const loadChatHistory = async () => {
      if (!sessionId) {
        setMessages([initialMessage]);
        return;
      }

      const persistedMessages = await chatAPI.getSessionMessages(sessionId);
      if (persistedMessages.length === 0) {
        setMessages([initialMessage]);
        return;
      }

      setMessages(
        persistedMessages.map((message) => ({
          id: `${message.message_type}-${message.created_at}`,
          role: message.message_type === 'assistant' ? 'assistant' : 'user',
          content: message.content,
        }))
      );
    };

    void loadChatHistory();
  }, [sessionId]);

  useEffect(() => {
    const loadRecentSessions = async () => {
      if (!isAuthenticated || !user?.id) {
        setRecentSessions([]);
        return;
      }

      const sessions = await chatAPI.getUserSessions(user.id);
      setRecentSessions(sessions);
    };

    void loadRecentSessions();
  }, [isAuthenticated, user?.id, sessionId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const handleNewChat = () => {
    setSessionId(null);
    setMessages([initialMessage]);
    setInput('');
    localStorage.removeItem(sessionStorageKey);

    toast({
      title: 'Started a new chat',
      description: isAuthenticated
        ? 'Your next message will open a fresh session while still using your older account context.'
        : 'Your next message will open a fresh guest session.',
    });
  };

  const handleOpenSession = (targetSessionId: string) => {
    setSessionId(targetSessionId);
    setInput('');
  };

  const handleAssistantAction = (actionType?: string | null) => {
    if (!actionType) {
      return;
    }

    if (actionType === 'checkout') {
      navigate('/checkout');
      setOpen(false);
      return;
    }

    if (actionType === 'add_to_cart') {
      openCart();
      toast({
        title: 'Cart opened',
        description: 'The assistant suggested adding an item. Review your bag here.',
      });
    }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) {
      return;
    }

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await salesAPI.sendMessage({
        message: trimmed,
        session_id: sessionId || undefined,
        user_id: isAuthenticated ? user?.id : undefined,
      });

      if (response.session_id) {
        setSessionId(response.session_id);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.reply,
        },
      ]);

      handleAssistantAction(response.action_type);
    } catch (error) {
      console.error('Failed to send sales message:', error);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I could not reach the shopping assistant just now. Please try again in a moment.',
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await sendMessage(input);
  };

  const formatSessionTimestamp = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Recent';
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="h-14 rounded-full px-5 shadow-xl bg-gradient-to-r from-brand-red via-brand-orange to-gold hover:from-brand-red-dark hover:via-brand-orange-dark hover:to-gold-dark text-white"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Ask Stylist AI
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
          <div className="flex h-full flex-col bg-background">
            <SheetHeader className="border-b px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-brand-red/20 via-brand-orange/20 to-gold/25">
                    <Bot className="h-5 w-5 text-brand-orange" />
                  </div>
                  <div>
                    <SheetTitle className="flex items-center gap-2 text-xl font-serif">
                      Sales Agent
                      <Badge variant="secondary" className="font-normal">
                        Live
                      </Badge>
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      Recommendations, offers, stock help, and shopping support.
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  disabled={isSending}
                >
                  New Chat
                </Button>
              </div>
            </SheetHeader>

            <div className="border-b px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => void sendMessage(prompt)}
                    disabled={isSending}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {prompt}
                  </Button>
                ))}
              </div>

              {isAuthenticated && recentSessions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <History className="h-3.5 w-3.5" />
                    Recent Threads
                  </div>
                  <div className="space-y-2">
                    {recentSessions.slice(0, 5).map((session) => (
                      <button
                        key={session.session_id}
                        type="button"
                        className={cn(
                          'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                          session.session_id === sessionId
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:bg-muted/40'
                        )}
                        onClick={() => handleOpenSession(session.session_id)}
                        disabled={isSending}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {session.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {session.last_message_preview}
                            </p>
                          </div>
                          <div className="shrink-0 text-[11px] text-muted-foreground">
                            {formatSessionTimestamp(session.updated_at)}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
                  >
                    {message.role === 'assistant' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Bot className="h-4 w-4 text-brand-orange" />
                      </div>
                    )}

                    <div
                      className={cn(
                        'max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm',
                        message.role === 'assistant'
                          ? 'bg-secondary text-foreground'
                          : 'bg-primary text-primary-foreground'
                      )}
                    >
                      {message.content}
                    </div>

                    {message.role === 'user' && (
                      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <UserIcon className="h-4 w-4 text-primary" />
                      </div>
                    )}
                  </div>
                ))}

                {isSending && (
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Bot className="h-4 w-4 text-brand-orange" />
                    </div>
                    <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            <form onSubmit={handleSubmit} className="border-t px-6 py-4">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask for products, sizes, offers, or order help..."
                  disabled={isSending}
                />
                <Button type="submit" size="icon" disabled={!canSend}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};
