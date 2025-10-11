import { useState } from 'react';
import { healthcareApi } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface HealthcareChatbotProps {
  userId: number;
}

export const AIAssistant = ({ userId }: HealthcareChatbotProps) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your healthcare assistant.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await healthcareApi.handleInterrupt(input, userId);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.message || response.response || 'I\'m here to help!',
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errorMessage: Message = {
        role: 'assistant',
        content: 'I apologize, but I encountered an error. Please try again.',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="flex h-[600px] flex-col p-6" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="mb-4 flex items-center gap-3 border-b pb-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg"
             style={{ background: 'var(--gradient-primary)' }}>
          <MessageCircle className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-semibold">Healthcare Assistant</h3>
          <p className="text-sm text-muted-foreground">AI-powered health companion</p>
        </div>
      </div>

      <ScrollArea className="flex-1 pr-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${
                message.role === 'user' ? 'flex-row-reverse' : 'flex-row'
              }`}
            >
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {message.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted'
                }`}
              >
                <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="flex gap-1">
                  <div className="h-2 w-2 animate-bounce rounded-full bg-secondary [animation-delay:-0.3s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-secondary [animation-delay:-0.15s]" />
                  <div className="h-2 w-2 animate-bounce rounded-full bg-secondary" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="mt-4 flex gap-2 border-t pt-4">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything..."
          disabled={loading}
          className="flex-1"
        />
        <Button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          size="icon"
          className="transition-all"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
};
