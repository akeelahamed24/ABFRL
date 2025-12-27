// AiChatWidget.tsx - Fixed and Working Version
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
import { useAuth } from "@/contexts/AuthContext";

interface Message {
  id: string;
  text: string;
  sender: "user" | "ai";
  timestamp: Date;
}

interface SuggestedAction {
  action: string;
  product_id?: string;
  label: string;
  type?: string;
  name?: string;
  price?: number;
  category?: string;
  image_url?: string;
  description?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
  suggestedActions?: SuggestedAction[];
}

type DisplayMode = "collapsed" | "expanded" | "fullscreen" | "sidebar";
type ViewMode = "chat" | "history";

const quickReplies = [
  "Show me summer dresses",
  "What's in stock?",
  "Track my order",
  "Return policy",
  "Size guide",
  "Recommend outfits",
];

// API Functions
const chatAPI = {
  sendMessage: async (token: string, data: {
    session_id: string;
    user_id: string;
    message: string;
  }) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  },

  deleteSession: async (token: string, sessionId: string) => {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/session/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }
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
  const { user, isAuthenticated, getToken } = useAuth();
  const [displayMode, setDisplayMode] = useState<DisplayMode>("collapsed");
  const [viewMode, setViewMode] = useState<ViewMode>("chat");
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("chat-sessions");
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [sessionId] = useState(() => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);

  // Save sessions to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("chat-sessions", JSON.stringify(sessions));
    }
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
    setSuggestedActions([]);
    setInputValue("");
    setViewMode("chat");
  }, []);

  const loadSession = useCallback((session: ChatSession) => {
    setCurrentSessionId(session.id);
    setMessages(session.messages);
    setSuggestedActions([]);
    setInputValue("");
    setViewMode("chat");
  }, []);

  const deleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    const token = getToken();
    if (!token) return;

    try {
      await chatAPI.deleteSession(token, sessionId);
      // Remove from local state after successful deletion
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setSuggestedActions([]);
      }
    } catch (error) {
      console.error('Failed to delete session:', error);
      // Still remove from local state as fallback
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
        setMessages([]);
        setSuggestedActions([]);
      }
    }
  }, [currentSessionId, getToken]);

  const handleSendMessage = useCallback(async (text?: string) => {
    const messageText = text || inputValue;
    if (!messageText.trim() || isLoading || !isAuthenticated || !user) return;

    const token = getToken();
    if (!token) {
      console.error("No auth token available");
      return;
    }

    // Create session if none exists
    let currentSession = sessionId;
    if (!currentSessionId) {
      const newSession: ChatSession = {
        id: currentSession,
        title: "New conversation",
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      setSessions(prev => [newSession, ...prev]);
      setCurrentSessionId(currentSession);
    } else {
      currentSession = currentSessionId;
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

    try {
      console.log("Sending message to backend...", {
        session_id: currentSession,
        user_id: user.id.toString(),
        message: messageText.trim()
      });

      const response = await chatAPI.sendMessage(token, {
        session_id: currentSession,
        user_id: user.id.toString(),
        message: messageText.trim(),
      });

      console.log("Backend response:", response);

      const aiMessage: Message = {
        id: `${Date.now()}-ai`,
        text: response.response || "I apologize, but I couldn't process your request. Please try again.",
        sender: "ai",
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);
      
      // Process suggested actions from backend
      if (response.suggested_actions && Array.isArray(response.suggested_actions)) {
        setSuggestedActions(response.suggested_actions.map((action: any) => ({
          action: action.action || "view_product",
          product_id: action.product_id,
          label: action.label || "View Details",
          type: action.type,
          name: action.name,
          price: action.price,
          category: action.category,
          image_url: action.image_url,
          description: action.description
        })));
      } else {
        setSuggestedActions([]);
      }
    } catch (error) {
      console.error('Chat API error:', error);
      const errorMessage: Message = {
        id: `${Date.now()}-ai`,
        text: "Sorry, I'm having trouble connecting to the server. Please check your connection and try again.",
        sender: "ai",
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
      setSuggestedActions([]);
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, isLoading, currentSessionId, isAuthenticated, user, getToken, sessionId]);

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
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (minutes < 1) return "Just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderMessage = (message: Message) => (
    <div
      key={message.id}
      className={cn(
        "flex mb-4",
        message.sender === "user" ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] text-sm leading-relaxed",
          message.sender === "user"
            ? "bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-3"
            : "bg-transparent"
        )}
      >
        {message.sender === "ai" && (
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shrink-0 mt-0.5">
              <span className="text-xs font-bold text-white">AI</span>
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <p className="whitespace-pre-wrap text-gray-800">{message.text}</p>
              <p className="text-xs text-gray-500 mt-1">{formatTime(message.timestamp)}</p>
            </div>
          </div>
        )}
        {message.sender === "user" && (
          <>
            <p className="whitespace-pre-wrap">{message.text}</p>
            <p className="text-xs text-blue-100 mt-1">{formatTime(message.timestamp)}</p>
          </>
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
          className="px-4 py-2 text-sm font-medium rounded-full border-2 border-gray-300 bg-white hover:border-blue-500 hover:bg-blue-50 transition-all duration-200 text-gray-700"
          disabled={isLoading || !isAuthenticated}
        >
          {reply}
        </button>
      ))}
    </div>
  );

  const renderSuggestedActions = () => {
    if (suggestedActions.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        {suggestedActions.map((action, index) => (
          <button
            key={index}
            onClick={() => {
              // Handle different action types
              if (action.action === 'view_product' && action.product_id) {
                // Navigate to product page
                window.location.href = `/product/${action.product_id}`;
              } else if (action.action === 'track_order') {
                window.location.href = '/orders';
              } else if (action.action === 'view_order') {
                window.location.href = '/orders';
              } else if (action.action === 'contact_support') {
                window.location.href = '/contact';
              } else {
                // Send the action label as a message
                handleSendMessage(action.label);
              }
            }}
            className="px-4 py-2 text-sm font-medium rounded-full border-2 border-orange-300 bg-orange-50 hover:border-orange-500 hover:bg-orange-100 transition-all duration-200 text-orange-700"
          >
            {action.label}
          </button>
        ))}
      </div>
    );
  };

  const renderProductRecommendations = () => {
    // Check if there are product recommendations in suggested actions
    const productActions = suggestedActions.filter(action => action.product_id);

    if (productActions.length === 0) return null;

    return (
      <div className="px-4 pb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {productActions.slice(0, 4).map((action, index) => (
            <div
              key={index}
              onClick={() => window.location.href = `/product/${action.product_id}`}
              className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow duration-200"
            >
              <div className="aspect-square bg-gray-100 rounded-md mb-3 overflow-hidden">
                <img
                  src={action.image_url || '/placeholder.svg'}
                  alt={action.name || 'Product'}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              </div>
              <div className="space-y-1">
                <h4 className="font-medium text-sm text-gray-900 line-clamp-2">
                  {action.name}
                </h4>
                <p className="text-xs text-gray-500">{action.category || 'Fashion Item'}</p>
                <p className="text-sm font-semibold text-orange-600">
                  ₹{action.price ? action.price.toLocaleString('en-IN') : '1,999'}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderInputArea = () => (
    <div className="p-4 border-t border-gray-200">
      <div className="flex items-center gap-3 bg-gray-50 rounded-full px-4 py-1">
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isAuthenticated ? "Type your message..." : "Sign in to start chatting"}
          className="flex-1 bg-transparent py-3 text-sm placeholder:text-gray-500 focus:outline-none"
          disabled={isLoading || !isAuthenticated}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!inputValue.trim() || isLoading || !isAuthenticated}
          className={cn(
            "p-2 rounded-full transition-all duration-200",
            inputValue.trim() && isAuthenticated && !isLoading
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "text-gray-400 bg-gray-200"
          )}
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
      <p className="text-xs text-gray-500 mt-2 text-center">
        Your AI fashion assistant is here to help!
      </p>
    </div>
  );

  const renderChatView = () => (
    <>
      <div className="flex-1 overflow-y-auto p-4">
        {!isAuthenticated ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">S</span>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Stylist AI</h3>
            <p className="text-sm text-gray-600 max-w-[280px] mx-auto leading-relaxed mb-6">
              Your personal shopping assistant for fashion advice, sizing, orders & style recommendations.
            </p>
            <button
              onClick={() => window.location.href = '/login'}
              className="px-6 py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-medium rounded-full hover:opacity-90 transition-opacity"
            >
              Sign In to Chat
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 px-4">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center">
              <span className="text-2xl font-bold text-white">S</span>
            </div>
            <h3 className="text-2xl font-semibold mb-2">Hello {user?.first_name || "there"}! 👋</h3>
            <p className="text-sm text-gray-600 max-w-[280px] mx-auto leading-relaxed mb-6">
              I'm your personal shopping assistant. How can I help you today?
            </p>
            {renderQuickReplies()}
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map(renderMessage)}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-yellow-500 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-white">AI</span>
                  </div>
                  <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              </div>
            )}
            {renderProductRecommendations()}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {isAuthenticated && renderInputArea()}
    </>
  );

  const renderHistoryView = () => (
    <div className="flex-1 overflow-y-auto">
      <div className="p-4 space-y-2">
        <button
          onClick={startNewChat}
          className="w-full flex items-center gap-3 p-4 rounded-2xl border-2 border-dashed border-gray-300 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200"
        >
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <span className="font-medium text-gray-700">New conversation</span>
        </button>
        
        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm">No past conversations</p>
            <p className="text-xs mt-2">Start a new chat to see history here</p>
          </div>
        )}
        
        {sessions.map((session) => (
          <div
            key={session.id}
            onClick={() => loadSession(session)}
            className={cn(
              "group flex items-center gap-3 p-4 rounded-2xl cursor-pointer transition-all duration-200",
              currentSessionId === session.id 
                ? "bg-blue-50 border border-blue-200" 
                : "hover:bg-gray-50 border border-transparent hover:border-gray-200"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
              currentSessionId === session.id 
                ? "bg-blue-100" 
                : "bg-gray-100"
            )}>
              <MessageCircle className={cn(
                "w-5 h-5",
                currentSessionId === session.id 
                  ? "text-blue-600" 
                  : "text-gray-500"
              )} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate text-gray-800">{session.title}</p>
              <p className="text-xs text-gray-500">{formatTime(session.updatedAt)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {session.messages.length} message{session.messages.length !== 1 ? 's' : ''}
              </p>
            </div>
            <button
              onClick={(e) => deleteSession(session.id, e)}
              className="p-2 rounded-full opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 transition-all duration-200 text-gray-400"
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
      "flex items-center justify-between border-b border-gray-200 shrink-0 bg-white",
      mode === "fullscreen" ? "px-6 py-4" : "px-4 py-3"
    )}>
      <div className="flex items-center gap-3">
        {viewMode === "history" ? (
          <button
            onClick={() => setViewMode("chat")}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-600" />
          </button>
        ) : (
          <button
            onClick={() => setViewMode("history")}
            className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors"
            title="View chat history"
          >
            <Clock className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div>
          <h3 className={cn(
            "font-semibold",
            mode === "fullscreen" ? "text-xl" : "text-lg"
          )}>
            {viewMode === "history" ? "Chat History" : "Stylist AI"}
          </h3>
          <p className="text-xs text-gray-500">
            {viewMode === "chat" ? "Your fashion assistant" : "Past conversations"}
          </p>
        </div>
      </div>
      
      <div className="flex items-center gap-1">
        {viewMode === "chat" && (
          <button
            onClick={startNewChat}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="New chat"
            title="Start new chat"
          >
            <Plus className="w-5 h-5 text-gray-600" />
          </button>
        )}
        {mode === "expanded" && (
          <>
            <button
              onClick={() => setDisplayMode("fullscreen")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Fullscreen"
              title="Fullscreen"
            >
              <Maximize2 className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setDisplayMode("sidebar")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Sidebar"
              title="Open in sidebar"
            >
              <PanelRight className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
        {mode === "fullscreen" && (
          <>
            <button
              onClick={() => setDisplayMode("expanded")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Minimize"
              title="Minimize"
            >
              <Minimize2 className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => setDisplayMode("sidebar")}
              className="p-2 rounded-full hover:bg-gray-100 transition-colors"
              aria-label="Sidebar"
              title="Open in sidebar"
            >
              <PanelRight className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}
        {mode === "sidebar" && (
          <button
            onClick={() => setDisplayMode("expanded")}
            className="p-2 rounded-full hover:bg-gray-100 transition-colors"
            aria-label="Pop out"
            title="Pop out"
          >
            <Minimize2 className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <button
          onClick={handleClose}
          className="p-2 rounded-full hover:bg-gray-100 transition-colors"
          aria-label="Close"
          title="Close"
        >
          <X className="w-5 h-5 text-gray-600" />
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
        aria-label="Open chat"
      >
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300" />
          <div className="relative w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-xl hover:scale-105 transition-transform duration-200">
            <MessageCircle className="w-6 h-6 text-white" />
          </div>
          {sessions.length > 0 && (
            <div className="absolute -top-1 -right-1 w-4 h-4 bg-orange-500 rounded-full border-2 border-white text-[8px] flex items-center justify-center text-white font-bold">
              {sessions.length}
            </div>
          )}
        </div>
      </button>
    );
  }

  // Expanded Mode (Modal)
  if (displayMode === "expanded") {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
        <div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative w-full sm:w-[400px] h-[90vh] sm:h-[650px] sm:max-h-[90vh] bg-white rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col">
          {renderHeader("expanded")}
          {viewMode === "chat" ? renderChatView() : renderHistoryView()}
        </div>
      </div>
    );
  }

  // Fullscreen Mode
  if (displayMode === "fullscreen") {
    return (
      <div className="fixed inset-0 z-50 bg-white flex flex-col">
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
          className="absolute inset-0 bg-black/50 sm:bg-black/30 backdrop-blur-sm"
          onClick={handleClose}
        />
        <div className="relative w-full sm:w-[420px] h-full bg-white border-l border-gray-200 flex flex-col shadow-2xl">
          {renderHeader("sidebar")}
          {viewMode === "chat" ? renderChatView() : renderHistoryView()}
        </div>
      </div>
    );
  }

  return null;
};

export default AIChatWidget;