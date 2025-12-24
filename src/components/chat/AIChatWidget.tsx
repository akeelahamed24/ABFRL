import { useState, useRef, useEffect, useCallback } from "react";
import {
  MessageCircle,
  Send,
  X,
  Maximize2,
  Minimize2,
  PanelRight,
  ChevronLeft,
  Loader2,
  Clock,
  Trash2,
  Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}

type DisplayMode = "collapsed" | "expanded" | "fullscreen" | "sidebar";
type ViewMode = "chat" | "history";

const quickReplies = [
  "Size guide",
  "Track order",
  "Returns",
  "Delivery info",
];

const sampleResponses: Record<string, string> = {
  size: "For the perfect fit, measure your chest and waist. Our size guide shows exact measurements for each size. Most customers find our fits run true to size. Need help with a specific item?",
  return: "Returns are free within 30 days. Items must be unworn with tags attached. We'll arrange pickup from your doorstep. Want me to start a return?",
  track: "Share your order ID or registered email, and I'll fetch the latest status for you instantly.",
  order: "Share your order ID or registered email, and I'll fetch the latest status for you instantly.",
  payment: "We accept Cards, UPI, Net Banking, Wallets, and COD. EMI available on orders above ₹3000. Which payment method interests you?",
  delivery: "Standard delivery: 5-7 days. Express: 1-2 days for select locations. Free shipping above ₹999.",
  exchange: "Exchanges are free within 30 days. Visit your order history or I can help you start one now.",
};

const getAIResponse = (userMessage: string): string => {
  const lowerMessage = userMessage.toLowerCase();
  for (const [keyword, response] of Object.entries(sampleResponses)) {
    if (lowerMessage.includes(keyword)) return response;
  }
  return "I'm here to help with sizing, orders, returns, and styling advice. What can I assist you with today?";
};

const generateSessionTitle = (messages: Message[]): string => {
  const firstUserMessage = messages.find(m => m.sender === "user");
  if (firstUserMessage) {
    const words = firstUserMessage.text.split(" ").slice(0, 4).join(" ");
    return words.length > 25 ? words.substring(0, 25) + "..." : words;
  }
  return "New conversation";
};

export const AIChatWidget = () => {
  const [displayMode, setDisplayMode] = useState<DisplayMode>("collapsed");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    const saved = localStorage.getItem("chat-sessions");
    return saved ? JSON.parse(saved) : [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save sessions to localStorage
  useEffect(() => {
    localStorage.setItem("chat-sessions", JSON.stringify(sessions));
  }, [sessions]);

  // Update current session when messages change
  useEffect(() => {
    if (currentSessionId && messages.length > 0) {
      setSessions(prev => prev.map(s => 
        s.id === currentSessionId 
          ? { ...s, messages, title: generateSessionTitle(messages), updatedAt: new Date() }
          : s
      ));
    }
  }, [messages, currentSessionId]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (displayMode !== "collapsed" && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [displayMode]);

  const startNewChat = useCallback(() => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: "New conversation",
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setMessages([]);
    setViewMode("chat");
  }, []);

  const loadSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setViewMode("chat");
  }, []);

  const deleteSession = useCallback((sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSessions(prev => prev.filter(s => s.id !== sessionId));
    if (currentSessionId === sessionId) {
      setCurrentSessionId(null);
      setMessages([]);
    }
  }, [currentSessionId]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim() || isLoading) return;

    // Create session if none exists
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: `session-${Date.now()}`,
        title: "New conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(newSession.id);
    }

    const userMessage: Message = {
      id: `${Date.now()}-user`,
      text: messageText.trim(),
      sender: "user",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 600));

    const aiMessage: Message = {
      id: `${Date.now()}-ai`,
      text: getAIResponse(messageText),
      sender: "ai",
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, aiMessage]);
    setIsLoading(false);
  }, [inputValue, isLoading, currentSessionId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  }, [handleSendMessage]);

  const handleClose = useCallback(() => {
    setDisplayMode("collapsed");
    setViewMode("chat");
  }, []);

  const handleExpand = useCallback(() => {
    setDisplayMode("expanded");
    if (!currentSessionId && sessions.length === 0) {
      startNewChat();
    }
  }, [currentSessionId, sessions.length, startNewChat]);

  const formatTime = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      className={cn(
        "flex",
        message.sender === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] text-sm leading-relaxed",
          message.sender === "user"
            ? "bg-foreground text-background rounded-[20px] rounded-br-sm px-4 py-3"
            : "bg-transparent"
        )}
      >
        {message.sender === "ai" && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-gold flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-accent-foreground">S</span>
            </div>
            <div className="bg-muted/80 rounded-[20px] rounded-tl-sm px-4 py-3">
              <p className="whitespace-pre-wrap">{message.text}</p>
            </div>
          </div>
        )}
        {message.sender === "user" && (
          <p className="whitespace-pre-wrap">{message.text}</p>
        )}
      </div>
    </div>
  );

  const renderQuickReplies = () => (
    <div className="flex flex-wrap gap-2 px-4 pb-4">
      {quickReplies.map((reply) => (
        <button
          key={reply}
          onClick={() => handleSendMessage(reply)}
          className="px-4 py-2 text-sm font-medium rounded-full border-2 border-foreground/10 bg-transparent hover:border-foreground/30 hover:bg-muted/50 transition-all duration-200"
        >
          {reply}
        </button>
      ))}
    </div>
  );

  const renderInputArea = () => (
    <div className="p-4 border-t border-border/30">
      <div className="flex items-center gap-3 bg-muted/50 rounded-full px-4 py-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message..."
          className="flex-1 bg-transparent py-3 text-sm placeholder:text-muted-foreground focus:outline-none"
          disabled={isLoading}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim() || isLoading}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            inputValue.trim() 
              ? "bg-foreground text-background hover:opacity-80" 
              : "text-muted-foreground"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );

  const renderChatView = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-brand-orange to-gold flex items-center justify-center">
              <span className="text-2xl font-serif font-bold text-accent-foreground">S</span>
            </div>
            <h3 className="font-serif text-2xl font-medium mb-2">Stylist</h3>
            <p className="text-sm text-muted-foreground max-w-[280px] mx-auto leading-relaxed">
              Your personal shopping assistant for sizing, orders & style advice.
            </p>
          </div>
        )}
        
        {messages.map(renderMessage)}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-brand-orange to-gold flex items-center justify-center shrink-0">
                <span className="text-xs font-bold text-accent-foreground">S</span>
              </div>
              <div className="bg-muted/80 rounded-[20px] rounded-tl-sm px-4 py-3">
                <div className="flex items-center gap-1">
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      {messages.length === 0 && renderQuickReplies()}
      {renderInputArea()}
    </>
  );

  const renderHistoryView = () => (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-2">
        <button
          onClick={startNewChat}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-border hover:border-foreground/30 hover:bg-muted/30 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-brand-orange to-gold flex items-center justify-center">
            <Plus className="w-5 h-5 text-accent-foreground" />
          </div>
          <span className="font-medium">New conversation</span>
        </button>
        
        {sessions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No past conversations</p>
          </div>
        )}
        
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => loadSession(session)}
            className={cn(
              "group flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-200",
              currentSessionId === session.id 
                ? "bg-muted" 
                : "hover:bg-muted/50"
            )}
          >
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{session.title}</p>
              <p className="text-xs text-muted-foreground">{formatTime(session.updatedAt)}</p>
            </div>
            <button
              onClick={(e) => deleteSession(session.id, e)}
              className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-all duration-200"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const renderHeader = (mode: "expanded" | "fullscreen" | "sidebar") => (
    <div className={cn(
      "flex items-center justify-between border-b border-border/30 shrink-0 bg-background",
      mode === "fullscreen" ? "px-6 py-4" : "px-4 py-3"
    )}>
      <div className="flex items-center gap-3">
        {viewMode === "history" ? (
          <button
            onClick={() => setViewMode("chat")}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => setViewMode("history")}
            className="p-2 -ml-2 rounded-full hover:bg-muted transition-colors"
          >
            <Clock className="w-5 h-5" />
          </button>
        )}
        <div>
          <h3 className={cn(
            "font-serif font-semibold",
            mode === "fullscreen" ? "text-xl" : "text-base"
          )}>
            {viewMode === "history" ? "Past Chats" : "Stylist"}
          </h3>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {viewMode === "chat" && (
          <button
            onClick={startNewChat}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="New chat"
          >
            <Plus className="w-5 h-5" />
          </button>
        )}
        {mode === "expanded" && (
          <>
            <button
              onClick={() => setDisplayMode("fullscreen")}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Fullscreen"
            >
              <Maximize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDisplayMode("sidebar")}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Sidebar"
            >
              <PanelRight className="w-5 h-5" />
            </button>
          </>
        )}
        {mode === "fullscreen" && (
          <>
            <button
              onClick={() => setDisplayMode("expanded")}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Minimize"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
            <button
              onClick={() => setDisplayMode("sidebar")}
              className="p-2 rounded-full hover:bg-muted transition-colors"
              aria-label="Sidebar"
            >
              <PanelRight className="w-5 h-5" />
            </button>
          </>
        )}
        {mode === "sidebar" && (
          <button
            onClick={() => setDisplayMode("expanded")}
            className="p-2 rounded-full hover:bg-muted transition-colors"
            aria-label="Pop out"
          >
            <Minimize2 className="w-5 h-5" />
          </button>
        )}
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // Collapsed Mode - Floating button
  if (displayMode === "collapsed") {
    return (
      <button
        onClick={handleExpand}
        className="fixed bottom-6 right-6 z-50 group"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-brand-orange to-gold rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
          <div className="relative w-14 h-14 bg-foreground rounded-full flex items-center justify-center shadow-2xl hover:scale-105 transition-transform duration-200">
            <MessageCircle className="w-6 h-6 text-background" />
          </div>
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-brand-orange rounded-full border-2 border-background" />
        </div>
      </button>
    );
  }

  // Expanded Mode (Modal)
  if (displayMode === "expanded") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50"
          onClick={handleClose}
        />
        <div className="relative w-full sm:w-[400px] h-[90vh] sm:h-[650px] sm:max-h-[90vh] bg-background rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {renderHeader("expanded")}
          {viewMode === "chat" ? renderChatView() : renderHistoryView()}
        </div>
      </div>
    );
  }

  // Fullscreen Mode
  if (displayMode === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {renderHeader("fullscreen")}
        <div className="flex-1 overflow-hidden flex flex-col max-w-2xl w-full mx-auto">
          {viewMode === "chat" ? renderChatView() : renderHistoryView()}
        </div>
      </div>
    );
  }

  // Sidebar Mode
  if (displayMode === "sidebar") {
    return (
      <div className="fixed inset-0 z-50 flex justify-end">
        <div
          className="absolute inset-0 bg-black/50 sm:bg-black/30"
          onClick={handleClose}
        />
        <div className="relative w-full sm:w-[420px] h-full bg-background border-l border-border flex flex-col shadow-2xl">
          {renderHeader("sidebar")}
          {viewMode === "chat" ? renderChatView() : renderHistoryView()}
        </div>
      </div>
    );
  }

  return null;
};

export default AIChatWidget;
