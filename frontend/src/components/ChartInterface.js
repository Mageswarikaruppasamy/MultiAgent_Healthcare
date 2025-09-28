// frontend/src/components/ChatInterface.js
import React, { useState, useRef, useEffect } from 'react';
import { CopilotChat } from '@copilotkit/react-ui';
import axios from 'axios';
import { Send, MessageCircle, Bot, User, Sparkles } from 'lucide-react';

const ChatInterface = ({ user }) => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        id: 1,
        type: 'bot',
        content: `Hello ${user.first_name}! 👋 I'm your AI health assistant. I can help you with questions about nutrition, health management, mood tracking, and using this app. What would you like to know?`,
        timestamp: new Date()
      }
    ]);
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: inputMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setLoading(true);

    try {
      const response = await axios.post('/api/interrupt', {
        user_id: user.id,
        query: inputMessage,
        current_context: {
          active_agent: 'chat',
          user_authenticated: true
        }
      });

      const botMessage = {
        id: messages.length + 2,
        type: 'bot',
        content: response.data.success ? response.data.message : 'I apologize, but I encountered an error processing your request.',
        timestamp: new Date(),
        questionType: response.data.question_type,
        navigationSuggestion: response.data.navigation_suggestion
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: messages.length + 2,
        type: 'bot',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again in a moment.',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const quickQuestions = [
    "How can I track my mood?",
    "What should I know about diabetes management?",
    "How do I log my food intake?",
    "What are healthy blood sugar ranges?",
    "How can I generate a meal plan?",
    "Tell me about the DASH diet",
    "What foods help with mood?",
    "How often should I check glucose?"
  ];

  const handleQuickQuestion = (question) => {
    setInputMessage(question);
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <MessageCircle className="chat-icon" />
        <div className="chat-title">
          <h2>AI Health Assistant</h2>
          <p>Ask me anything about health, nutrition, or app features</p>
        </div>
      </div>

      <div className="messages-container">
        {messages.map((message) => (
          <div key={message.id} className={`message ${message.type}`}>
            <div className="message-avatar">
              {message.type === 'bot' ? (
                <Bot className="avatar-icon bot" />
              ) : (
                <User className="avatar-icon user" />
              )}
            </div>
            
            <div className="message-content">
              <div className="message-bubble">
                {message.content}
              </div>
              
              <div className="message-meta">
                <span className="message-time">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </span>
                {message.questionType && (
                  <span className="question-type">
                    {message.questionType.replace('_', ' ')}
                  </span>
                )}
              </div>

              {message.navigationSuggestion && (
                <div className="navigation-suggestion">
                  <Sparkles className="suggestion-icon" />
                  <span>{message.navigationSuggestion}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        
        {loading && (
          <div className="message bot">
            <div className="message-avatar">
              <Bot className="avatar-icon bot" />
            </div>
            <div className="message-content">
              <div className="message-bubble typing">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span>Thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {messages.length === 1 && (
        <div className="quick-questions">
          <h3>Quick Questions</h3>
          <div className="question-buttons">
            {quickQuestions.map((question, index) => (
              <button
                key={index}
                className="quick-question-btn"
                onClick={() => handleQuickQuestion(question)}
                disabled={loading}
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="chat-input-form">
        <div className="input-container">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Ask me about your health, nutrition, or app features..."
            disabled={loading}
            className="chat-input"
            maxLength={500}
          />
          <button 
            type="submit" 
            disabled={loading || !inputMessage.trim()}
            className="send-button"
          >
            <Send className="send-icon" />
          </button>
        </div>
      </form>

      <div className="chat-footer">
        <p>💡 I can help with health questions, app navigation, and provide general wellness guidance. For medical emergencies, contact your healthcare provider.</p>
      </div>
    </div>
  );
};

export default ChatInterface;