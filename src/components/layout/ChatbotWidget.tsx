import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import { Bot, MessageCircle, Send, Sparkles, User as UserIcon, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { mockProducts } from '@/data/mockData';
import { Product } from '@/types';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  products?: Product[];
}

const STARTER_PROMPTS = [
  'Recommend an outfit for a wedding',
  'Show me men\'s formal wear',
  'What\'s available under $300?',
];

const initialMessage: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content: 'Hi! 👋 I\'m your **Style Assistant**. I can help you find the perfect outfit!\n\nAsk me about:\n- 🎉 Outfit recommendations for any occasion\n- 👗 Browse by category or style\n- 💰 Products within your budget\n- 📦 Product details and availability',
};

function searchProducts(query: string): { reply: string; products: Product[] } {
  const q = query.toLowerCase();

  // Price filter
  const priceMatch = q.match(/under\s*\$?\s*(\d+)/);
  const minPriceMatch = q.match(/(?:above|over|more than)\s*\$?\s*(\d+)/);

  // Category keywords
  const categoryMap: Record<string, string[]> = {
    'women-dresses': ['dress', 'dresses', 'gown', 'gowns'],
    'women-tops': ['blouse', 'top', 'tops', 'camisole'],
    'women-bottoms': ['trousers', 'pants', 'bottoms', 'wide-leg'],
    'women-outerwear': ['coat', 'jacket', 'outerwear'],
    'men-shirts': ['shirt', 'shirts'],
    'men-suits': ['suit', 'suits', 'tuxedo', 'blazer'],
    'men-pants': ['trousers', 'pants', 'chinos'],
    'men-outerwear': ['coat', 'jacket', 'bomber', 'peacoat'],
    'kids-girls': ['girls', 'girl'],
    'kids-boys': ['boys', 'boy'],
    'kids-baby': ['baby', 'infant', 'christening'],
  };

  const occasionKeywords = ['formal', 'casual', 'party', 'wedding', 'office', 'vacation'];
  const genderKeywords: Record<string, string> = {
    "men's": 'men',
    "mens": 'men',
    "men": 'men',
    "women's": 'women',
    "womens": 'women',
    "women": 'women',
    "kids": 'kids',
    "children": 'kids',
  };

  let filtered = [...mockProducts];

  // Gender filter
  for (const [keyword, gender] of Object.entries(genderKeywords)) {
    if (q.includes(keyword)) {
      filtered = filtered.filter(p => p.dress_category.startsWith(gender));
      break;
    }
  }

  // Category filter
  for (const [cat, keywords] of Object.entries(categoryMap)) {
    if (keywords.some(k => q.includes(k))) {
      filtered = filtered.filter(p => p.dress_category === cat);
      break;
    }
  }

  // Occasion filter
  const matchedOccasion = occasionKeywords.find(o => q.includes(o));
  if (matchedOccasion) {
    filtered = filtered.filter(p => p.occasion === matchedOccasion);
  }

  // Price filters
  if (priceMatch) {
    const maxPrice = parseInt(priceMatch[1]);
    filtered = filtered.filter(p => p.price <= maxPrice);
  }
  if (minPriceMatch) {
    const minPrice = parseInt(minPriceMatch[1]);
    filtered = filtered.filter(p => p.price >= minPrice);
  }

  // Text search fallback
  if (filtered.length === mockProducts.length && !priceMatch && !minPriceMatch && !matchedOccasion) {
    const words = q.split(/\s+/).filter(w => w.length > 2);
    filtered = mockProducts.filter(p => {
      const text = `${p.product_name} ${p.description} ${p.material} ${p.dress_category} ${p.occasion} ${p.colors}`.toLowerCase();
      return words.some(w => text.includes(w));
    });
  }

  // Sort featured first
  filtered.sort((a, b) => (b.featured_dress ? 1 : 0) - (a.featured_dress ? 1 : 0));

  const results = filtered.slice(0, 6);

  if (results.length === 0) {
    return {
      reply: "I couldn't find products matching your request. Try asking about:\n- **Categories**: dresses, suits, shirts, outerwear\n- **Occasions**: formal, casual, party, wedding, office\n- **Budget**: \"under $500\", \"above $200\"\n- **Gender**: men's, women's, kids",
      products: [],
    };
  }

  // Build markdown table
  let reply = `Found **${filtered.length} product${filtered.length > 1 ? 's' : ''}** for you! Here are the top picks:\n\n`;
  reply += `| Product | Price | Material | Occasion |\n`;
  reply += `|---------|-------|----------|----------|\n`;

  for (const p of results) {
    const name = p.product_name;
    const price = `$${p.price.toFixed(0)}`;
    const material = p.material?.split(',')[0] || '—';
    const occasion = p.occasion ? p.occasion.charAt(0).toUpperCase() + p.occasion.slice(1) : '—';
    reply += `| ${name} | ${price} | ${material} | ${occasion} |\n`;
  }

  if (filtered.length > 6) {
    reply += `\n*...and ${filtered.length - 6} more results.*\n`;
  }

  reply += `\n👆 Click any product card below to view details!`;

  return { reply, products: results };
}

function generateResponse(userMessage: string): ChatMessage {
  const q = userMessage.toLowerCase();

  // Greetings
  if (/^(hi|hello|hey|hola|namaste|sup)\b/.test(q)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: "Hello! 😊 How can I help you today? I can recommend outfits, show products by category, or help you find something in your budget!",
    };
  }

  // Thanks
  if (/thank|thanks|thx/.test(q)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: "You're welcome! 💖 Let me know if you need anything else. Happy shopping!",
    };
  }

  // Help
  if (/^(help|what can you do|commands)/.test(q)) {
    return {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: "Here's what I can do:\n\n| Command | Example |\n|---------|--------|\n| 🔍 Search products | *\"Show me silk dresses\"* |\n| 🎉 Occasion search | *\"Outfit for a wedding\"* |\n| 💰 Budget search | *\"Products under $300\"* |\n| 👔 Category browse | *\"Men's suits\"* |\n| 👧 Kids' fashion | *\"Girls' party dresses\"* |\n\nJust type naturally — I'll understand!",
    };
  }

  // Product search
  const { reply, products } = searchProducts(userMessage);
  return {
    id: `assistant-${Date.now()}`,
    role: 'assistant',
    content: reply,
    products,
  };
}

export const ChatbotWidget = () => {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([initialMessage]);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const handleNewChat = () => {
    setMessages([initialMessage]);
    setInput('');
  };

  const sendMessage = (messageText: string) => {
    const trimmed = messageText.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);

    // Simulate slight delay for natural feel
    setTimeout(() => {
      const response = generateResponse(trimmed);
      setMessages(prev => [...prev, response]);
      setIsSending(false);
    }, 400 + Math.random() * 400);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50 md:bottom-6 md:right-6">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            size="lg"
            className="h-14 rounded-full px-5 shadow-xl bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <MessageCircle className="h-5 w-5 mr-2" />
            Ask Stylist AI
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
          <div className="flex h-full flex-col bg-background">
            {/* Header */}
            <SheetHeader className="border-b px-6 py-5 text-left">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <SheetTitle className="flex items-center gap-2 text-xl font-serif">
                      Style Assistant
                      <Badge variant="secondary" className="font-normal text-xs">AI</Badge>
                    </SheetTitle>
                    <p className="text-sm text-muted-foreground">
                      Fashion recommendations & product search
                    </p>
                  </div>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={handleNewChat}>
                  New Chat
                </Button>
              </div>
            </SheetHeader>

            {/* Starter prompts */}
            <div className="border-b px-6 py-4">
              <div className="flex flex-wrap gap-2">
                {STARTER_PROMPTS.map(prompt => (
                  <Button
                    key={prompt}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() => sendMessage(prompt)}
                    disabled={isSending}
                  >
                    <Sparkles className="mr-2 h-3.5 w-3.5" />
                    {prompt}
                  </Button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-5">
              <div className="space-y-4">
                {messages.map(message => (
                  <div key={message.id}>
                    <div
                      className={cn(
                        'flex gap-3',
                        message.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {message.role === 'assistant' && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                          <Bot className="h-4 w-4 text-primary" />
                        </div>
                      )}

                      <div
                        className={cn(
                          'max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm',
                          message.role === 'assistant'
                            ? 'bg-secondary text-foreground'
                            : 'bg-primary text-primary-foreground'
                        )}
                      >
                        {message.role === 'assistant' ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&_table]:text-xs [&_table]:w-full [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-semibold [&_th]:border-b [&_th]:border-border [&_td]:px-2 [&_td]:py-1.5 [&_td]:border-b [&_td]:border-border/50 [&_p]:my-1 [&_ul]:my-1 [&_li]:my-0.5 [&_strong]:text-foreground [&_em]:text-muted-foreground">
                            <ReactMarkdown>{message.content}</ReactMarkdown>
                          </div>
                        ) : (
                          message.content
                        )}
                      </div>

                      {message.role === 'user' && (
                        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <UserIcon className="h-4 w-4 text-primary" />
                        </div>
                      )}
                    </div>

                    {/* Product cards */}
                    {message.products && message.products.length > 0 && (
                      <div className="mt-3 ml-11 grid grid-cols-2 gap-2">
                        {message.products.map(product => (
                          <Link
                            key={product.id}
                            to={`/product/${product.id}`}
                            onClick={() => setOpen(false)}
                            className="group block rounded-xl border border-border bg-card p-2 transition-all hover:shadow-md hover:border-primary/30"
                          >
                            <div className="aspect-square w-full overflow-hidden rounded-lg bg-muted mb-2">
                              <img
                                src={product.image_url || '/placeholder.svg'}
                                alt={product.product_name}
                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              />
                            </div>
                            <p className="text-xs font-medium text-foreground line-clamp-2 leading-tight">
                              {product.product_name}
                            </p>
                            <p className="text-xs font-semibold text-primary mt-1">
                              ${product.price.toFixed(0)}
                            </p>
                            {product.occasion && (
                              <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                                {product.occasion}
                              </Badge>
                            )}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isSending && (
                  <div className="flex gap-3">
                    <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                    <div className="rounded-2xl bg-secondary px-4 py-3 text-sm text-muted-foreground flex items-center gap-2">
                      <span className="flex gap-1">
                        <span className="animate-bounce [animation-delay:0ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="animate-bounce [animation-delay:150ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        <span className="animate-bounce [animation-delay:300ms] h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                      </span>
                      Thinking...
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>

            {/* Input */}
            <form onSubmit={handleSubmit} className="border-t px-6 py-4">
              <div className="flex gap-3">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask about products, outfits, or occasions..."
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
