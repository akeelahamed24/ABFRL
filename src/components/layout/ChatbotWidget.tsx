import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Link } from 'react-router-dom';
import {
  Bot, History, MessageCircle, Send, Sparkles,
  User as UserIcon, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { chatAPI, ChatSessionSummary, salesAPI } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Product } from '@/types';
import { productAPI } from '@/services/api';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

const SESSION_KEY = 'sales_chat_session_id';

const STARTER_PROMPTS = [
  'Recommend an outfit for a wedding',
  "Show me men's formal wear",
  'What products are available under 3000?',
];

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Hi, I am your ABFRL shopping assistant. Ask for outfit ideas, stock help, offers, checkout guidance, or order support.',
};

/* ─── Markdown table sub-components ─── */
const TableComponent = ({ children, ...props }: any) => (
  <div className="overflow-x-auto my-3 rounded-lg border border-border max-w-full">
    <table className="min-w-full divide-y divide-border table-auto" {...props}>
      {children}
    </table>
  </div>
);
const TableHeadComponent = ({ children, ...props }: any) => (
  <thead className="bg-muted/50" {...props}>{children}</thead>
);
const TableBodyComponent = ({ children, ...props }: any) => (
  <tbody className="divide-y divide-border" {...props}>{children}</tbody>
);
const TableRowComponent = ({ children, ...props }: any) => (
  <tr className="transition-colors hover:bg-muted/30" {...props}>{children}</tr>
);
const TableHeaderCellComponent = ({ children, ...props }: any) => (
  <th className="px-3 py-2 text-left text-xs font-semibold text-foreground uppercase tracking-wider" {...props}>
    {children}
  </th>
);
const TableCellComponent = ({ children, ...props }: any) => (
  <td className="px-3 py-2 text-sm text-foreground" {...props}>{children}</td>
);

/* ─── Main component ─── */
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
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [showRecentThreads, setShowRecentThreads] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const historyRequestRef = useRef(0);

  const sessionStorageKey = useMemo(
    () =>
      isAuthenticated && user?.id
        ? `${SESSION_KEY}:${user.id}`
        : `${SESSION_KEY}:guest`,
    [isAuthenticated, user?.id]
  );

  /* ── session persistence ── */
  useEffect(() => {
    const savedSessionId = localStorage.getItem(sessionStorageKey);
    setSessionId(savedSessionId || null);
    setMessages([initialMessage]);
    setInput('');
  }, [sessionStorageKey]);

  useEffect(() => {
    if (sessionId) {
      localStorage.setItem(sessionStorageKey, sessionId);
    } else {
      localStorage.removeItem(sessionStorageKey);
    }
  }, [sessionId, sessionStorageKey]);

  const loadRecentSessions = async () => {
    if (!isAuthenticated || !user?.id) {
      setRecentSessions([]);
      return;
    }

    const sessions = await chatAPI.getUserSessions(user.id);
    setRecentSessions(sessions);
  };

  /* ── load history ── */
  useEffect(() => {
    const requestId = ++historyRequestRef.current;

    const loadChatHistory = async () => {
      if (!sessionId) {
        setIsHistoryLoading(false);
        setMessages([initialMessage]);
        return;
      }

      setIsHistoryLoading(true);
      const persistedMessages = await chatAPI.getSessionMessages(sessionId);
      if (historyRequestRef.current !== requestId) {
        return;
      }

      if (persistedMessages.length === 0) {
        setIsHistoryLoading(false);
        setMessages([initialMessage]);
        return;
      }

      setMessages(
        persistedMessages.map((m) => ({
          id: `${m.message_type}-${m.created_at}`,
          role: m.message_type === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }))
      );
      setIsHistoryLoading(false);
    };

    void loadChatHistory();

    return () => {
      if (historyRequestRef.current === requestId) {
        historyRequestRef.current += 1;
      }
    };
  }, [sessionId]);

  /* ── recent sessions ── */
  useEffect(() => {
    void loadRecentSessions();
  }, [isAuthenticated, user?.id]);

  /* ── auto-scroll ── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  /* ── handlers ── */
  const handleNewChat = () => {
    setSessionId(null);
    setMessages([initialMessage]);
    setInput('');
    setIsHistoryLoading(false);
    localStorage.removeItem(sessionStorageKey);
    toast({
      title: 'Started a new chat',
      description: isAuthenticated
        ? 'Your next message will open a fresh session while still using your older account context.'
        : 'Your next message will open a fresh guest session.',
    });
  };

  const handleOpenSession = (targetSessionId: string) => {
    if (targetSessionId === sessionId) {
      return;
    }
    setSessionId(targetSessionId);
    setInput('');
    setShowRecentThreads(false);
  };

  const handleAssistantAction = (actionType?: string | null) => {
    if (!actionType) return;
    if (actionType === 'checkout') { navigate('/checkout'); setOpen(false); return; }
    if (actionType === 'add_to_cart') {
      openCart();
      toast({ title: 'Cart opened', description: 'The assistant suggested adding an item. Review your bag here.' });
    }
  };

  const searchProducts = async (query: string): Promise<Product[]> => {
    try { return await productAPI.getProducts({ q: query }); }
    catch { return []; }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({ title: 'Copied!', description: 'Message copied to clipboard' });
    } catch { /* silent */ }
  };

  const sendMessage = async (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = { id: `user-${Date.now()}`, role: 'user', content: trimmed, products: [] };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    try {
      const response = await salesAPI.sendMessage({
        message: trimmed,
        session_id: sessionId || undefined,
        user_id: isAuthenticated ? user?.id : undefined,
      });
      if (response.session_id) setSessionId(response.session_id);
      void loadRecentSessions();

      const products = await searchProducts(trimmed);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${Date.now()}`, role: 'assistant', content: response.reply, products },
      ]);
      handleAssistantAction(response.action_type);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'I could not reach the shopping assistant just now. Please try again in a moment.',
          products: [],
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
    if (Number.isNaN(date.getTime())) return 'Recent';
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(date);
  };

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <div className="fixed bottom-20 right-4 z-50 sm:bottom-6 sm:right-6">
      <Sheet open={open} onOpenChange={setOpen}>

        {/* ── FAB ── */}
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="h-13 gap-2 rounded-full px-5 shadow-xl bg-primary hover:bg-primary/90
                       text-primary-foreground transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <MessageCircle className="h-5 w-5 shrink-0" />
            <span className="hidden xs:inline">Ask Stylist AI</span>
          </Button>
        </SheetTrigger>

        {/* ── Panel ── */}
        <SheetContent
          side="right"
          className={cn(
            'p-0 flex flex-col',
            'w-screen sm:w-[680px] sm:max-w-[92vw] lg:w-[820px] lg:max-w-[820px]',
            'h-[100dvh]',
            'overflow-hidden',
          )}
        >
          <div className="flex h-full flex-col bg-background overflow-hidden">

            {/* ── Header ── */}
            <SheetHeader className="shrink-0 border-b px-4 sm:px-6 py-4 text-left bg-gradient-to-r from-primary/5 to-transparent">
              <div className="flex items-center justify-between gap-3 min-w-0">

                {/* Left: avatar + title */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 animate-pulse">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="flex items-center gap-2 text-base sm:text-xl font-serif leading-tight truncate">
                      Style Assistant
                      <Badge variant="secondary" className="shrink-0 font-normal text-xs bg-primary/10 text-primary">
                        AI
                      </Badge>
                    </SheetTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground truncate">
                      Fashion recommendations & product search
                    </p>
                  </div>
                </div>

                {/* Right: New Chat */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleNewChat}
                  className="shrink-0 hover:bg-primary/10 text-xs sm:text-sm"
                >
                  New Chat
                </Button>
              </div>
            </SheetHeader>

            {/* ── Starter prompts ── */}
            <div className="shrink-0 border-b px-4 sm:px-6 py-3 bg-muted/5">
              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full hover:bg-primary/10 hover:border-primary transition-all text-xs"
                    onClick={() => sendMessage(prompt)}
                    disabled={isSending}
                  >
                    <Sparkles className="mr-1.5 h-3 w-3 shrink-0" />
                    <span className="truncate max-w-[140px] sm:max-w-none">{prompt}</span>
                  </Button>
                ))}
              </div>

              {isAuthenticated && recentSessions.length > 0 && (
                <div className="mt-4 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowRecentThreads((prev) => !prev)}
                    className="flex w-full items-center justify-between rounded-lg border border-border px-3 py-2 text-left transition-colors hover:bg-muted/40"
                  >
                    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      <History className="h-3.5 w-3.5" />
                      Recent Threads
                    </div>
                    {showRecentThreads ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  {showRecentThreads && (
                    <div className="max-h-52 space-y-2 overflow-y-auto pr-1">
                      {recentSessions.slice(0, 5).map((session) => (
                        <button
                          key={session.session_id}
                          type="button"
                          onClick={() => handleOpenSession(session.session_id)}
                          disabled={isSending}
                          className={cn(
                            'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                            session.session_id === sessionId
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:bg-muted/40'
                          )}
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
                  )}
                </div>
              )}
            </div>

            {/* ── Messages ── */}
            <div className="flex-1 min-h-0 min-w-0">
              <ScrollArea className="h-full px-4 sm:px-6 py-4">
                <div className="space-y-4 pb-2">

                  {messages.map((message) => (
                    // FIX: added min-w-0 to prevent flex children from overflowing
                    <div key={message.id} className="group min-w-0">
                      <div
                        className={cn(
                          'flex gap-2 sm:gap-3 min-w-0',
                          message.role === 'user' ? 'justify-end' : 'justify-start'
                        )}
                      >
                        {/* Bot avatar */}
                        {message.role === 'assistant' && (
                          <div className="mt-1 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                            <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          </div>
                        )}

                        {/* Bubble
                            FIX: added min-w-0 so the bubble can shrink below content size,
                            and overflow-hidden so children (tables) are clipped to the bubble boundary.
                        */}
                        <div
                          className={cn(
                            'relative min-w-0 overflow-hidden group/message rounded-2xl px-3.5 sm:px-4 py-3 text-sm leading-relaxed shadow-sm',
                            message.role === 'assistant'
                              ? 'max-w-[calc(100%-3rem)] sm:max-w-[96%]'
                              : 'max-w-[calc(100%-3rem)] sm:max-w-[78%] lg:max-w-[72%]',
                            message.role === 'assistant'
                              ? 'bg-secondary text-foreground'
                              : 'bg-primary text-primary-foreground'
                          )}
                        >
                          {/* Copy button (assistant only) */}
                          {message.role === 'assistant' && (
                            <button
                              onClick={() => copyToClipboard(message.content, message.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover/message:opacity-100
                                         transition-opacity p-1 rounded hover:bg-muted"
                              aria-label="Copy message"
                            >
                              {copiedMessageId === message.id ? (
                                <Check className="h-3.5 w-3.5 text-green-500" />
                              ) : (
                                <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                              )}
                            </button>
                          )}

                          {/* Content */}
                          {message.role === 'assistant' ? (
                            <div
                              className={cn(
                                // FIX: w-full + min-w-0 ensures prose container never exceeds bubble width.
                                // Removed [&_table]:block and [&_table]:overflow-x-auto — table scrolling is
                                // now handled by the wrapper div inside TableComponent instead, which prevents
                                // the table from blowing out the flex layout.
                                'prose prose-sm dark:prose-invert w-full min-w-0',
                                'overflow-hidden',
                                '[&_p]:my-2 [&_p]:leading-relaxed [&_p]:break-words',
                                '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-4',
                                '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-4',
                                '[&_li]:my-0.5',
                                '[&_strong]:text-foreground [&_strong]:font-semibold',
                                '[&_em]:text-muted-foreground',
                                '[&_h1]:text-base [&_h1]:font-bold [&_h1]:my-3',
                                '[&_h2]:text-sm [&_h2]:font-semibold [&_h2]:my-2',
                                '[&_h3]:text-sm [&_h3]:font-semibold [&_h3]:my-1.5',
                                '[&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
                                '[&_code]:text-xs [&_code]:font-mono [&_code]:break-all',
                                '[&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg',
                                '[&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:my-2',
                                '[&_blockquote]:border-l-4 [&_blockquote]:border-primary',
                                '[&_blockquote]:pl-3 [&_blockquote]:my-2 [&_blockquote]:italic',
                                '[&_hr]:my-3 [&_hr]:border-border',
                                'pr-6', // right padding so copy button never overlaps text
                              )}
                            >
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                rehypePlugins={[rehypeRaw]}
                                components={{
                                  table: TableComponent,
                                  thead: TableHeadComponent,
                                  tbody: TableBodyComponent,
                                  tr: TableRowComponent,
                                  th: TableHeaderCellComponent,
                                  td: TableCellComponent,
                                  code({ node, inline, className, children, ...props }: any) {
                                    const match = /language-(\w+)/.exec(className || '');
                                    return !inline && match ? (
                                      <SyntaxHighlighter
                                        style={vscDarkPlus}
                                        language={match[1]}
                                        PreTag="div"
                                        {...props}
                                      >
                                        {String(children).replace(/\n$/, '')}
                                      </SyntaxHighlighter>
                                    ) : (
                                      <code className={className} {...props}>{children}</code>
                                    );
                                  },
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          ) : (
                            <div className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
                              {message.content}
                            </div>
                          )}

                          {/* Product cards */}
                          {message.products && message.products.length > 0 && (
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3">
                              {message.products.slice(0, 4).map((product) => (
                                <Link
                                  key={product.id}
                                  to={`/product/${product.id}`}
                                  onClick={() => setOpen(false)}
                                  className="group/card block rounded-xl border border-border bg-card p-2 sm:p-3
                                             transition-all hover:shadow-lg hover:border-primary/30 hover:-translate-y-0.5"
                                >
                                  {/* Image */}
                                  <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted mb-2">
                                    <img
                                      src={product.image_url || '/placeholder.svg'}
                                      alt={product.product_name}
                                      className="h-full w-full object-cover transition-transform group-hover/card:scale-105"
                                      loading="lazy"
                                    />
                                  </div>

                                  {/* Name */}
                                  <p className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 leading-tight mb-1">
                                    {product.product_name}
                                  </p>

                                  {/* Price + occasion badge */}
                                  <div className="flex items-center justify-between gap-1 flex-wrap">
                                    <p className="text-xs sm:text-sm font-bold text-primary shrink-0">
                                      ₹{product.price.toFixed(0)}
                                    </p>
                                    {(product as any).occasion && (
                                      <Badge variant="outline" className="text-[9px] sm:text-[10px] px-1 py-0 shrink-0">
                                        {(product as any).occasion}
                                      </Badge>
                                    )}
                                  </div>

                                  {/* Brand */}
                                  {(product as any).brand && (
                                    <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">
                                      {(product as any).brand}
                                    </p>
                                  )}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* User avatar */}
                        {message.role === 'user' && (
                          <div className="mt-1 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Typing indicator */}
                  {isSending && (
                    <div className="flex gap-2 sm:gap-3">
                      <div className="mt-1 flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                        <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary" />
                      </div>
                      <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                        <span className="flex gap-1 items-center">
                          <span className="animate-bounce [animation-delay:0ms]   h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          <span className="animate-bounce [animation-delay:150ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                          <span className="animate-bounce [animation-delay:300ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        </span>
                        Thinking…
                      </div>
                    </div>
                  )}

                  <div ref={bottomRef} />
                </div>
              </ScrollArea>
            </div>

            {/* ── Input footer ── */}
            <form
              onSubmit={handleSubmit}
              className="shrink-0 border-t px-4 sm:px-6 py-3 sm:py-4 bg-background
                         pb-[env(safe-area-inset-bottom,0px)]"
            >
              <div className="flex items-end gap-2 sm:gap-3">
                <Textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (canSend && !isHistoryLoading) {
                        void sendMessage(input);
                      }
                    }
                  }}
                  placeholder="Ask about products, outfits, or occasions..."
                  disabled={isSending || isHistoryLoading}
                  rows={2}
                  className="min-h-[52px] flex-1 resize-none text-sm leading-5"
                />
                <Button
                  type="submit"
                  size="icon"
                  disabled={!canSend || isHistoryLoading}
                  className="mb-1 shrink-0 transition-all hover:scale-105 active:scale-95"
                  aria-label="Send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {isHistoryLoading && (
                <p className="mt-2 text-[10px] sm:text-xs text-muted-foreground text-center">
                  Loading selected chat…
                </p>
              )}
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-2 text-center leading-none">
                Powered by AI • Get personalised fashion recommendations
              </p>
            </form>

          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};