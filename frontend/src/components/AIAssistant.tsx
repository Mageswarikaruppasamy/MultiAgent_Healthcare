import { useState, useEffect } from 'react';
import { healthcareApi } from '@/services/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageCircle, Send, Bot, User, Heart, Utensils, Calendar, Droplet } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

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
      content: 'Hello! I\'m your healthcare assistant. You can ask me to:\n- Log your mood (e.g., "I\'m feeling happy")\n- Log your glucose reading (e.g., "My glucose is 120")\n- Generate meal plans (e.g., "Generate a meal plan")\n- Analyze nutrition (e.g., "What are the nutrition values in a grilled chicken sandwich?")\n\nHow can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Function to detect glucose logging requests
  const isGlucoseLoggingRequest = (text: string): boolean => {
    const glucoseKeywords = ['glucose', 'blood sugar', 'sugar level', 'cgm'];
    const hasGlucoseKeyword = glucoseKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasNumber = /\d/.test(text);
    const isQuestion = text.toLowerCase().includes('why') || text.toLowerCase().includes('how') || text.toLowerCase().includes('what');
    
    // Only consider it a glucose logging request if it has glucose keywords and a number, but not a question
    return hasGlucoseKeyword && hasNumber && !isQuestion;
  };

  // Function to detect mood logging requests
  const isMoodLoggingRequest = (text: string): boolean => {
    const moodKeywords = ['happy', 'sad', 'angry', 'calm', 'tired', 'anxious', 'feeling'];
    const hasMoodKeyword = moodKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const isQuestion = text.toLowerCase().includes('why') || text.toLowerCase().includes('how') || text.toLowerCase().includes('what');
    
    // Only consider it a mood logging request if it has mood keywords but not a question
    return hasMoodKeyword && !isQuestion;
  };

  // Function to detect meal planning requests
  const isMealPlanningRequest = (text: string): boolean => {
    const mealKeywords = ['meal', 'plan', 'breakfast', 'lunch', 'dinner', 'generate'];
    const hasMealKeyword = mealKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const isQuestion = text.toLowerCase().includes('why') || text.toLowerCase().includes('how') || text.toLowerCase().includes('what');
    
    // Only consider it a meal planning request if it has meal keywords but not a question
    return hasMealKeyword && !isQuestion;
  };

  // Function to detect nutrition analysis requests
  const isNutritionAnalysisRequest = (text: string): boolean => {
    const nutritionKeywords = ['nutrition', 'nutrients', 'calories', 'protein', 'carbs', 'fat', 'analyze'];
    const questionWords = ['what are', 'how much', 'tell me'];
    const hasNutritionKeyword = nutritionKeywords.some(keyword => text.toLowerCase().includes(keyword));
    const hasQuestionPhrase = questionWords.some(phrase => text.toLowerCase().includes(phrase));
    const isGeneralQuestion = text.toLowerCase().includes('why') || text.toLowerCase().includes('how') || text.toLowerCase().includes('what');
    
    // More specific detection for nutrition analysis requests
    const nutritionFoodPhrases = [
      'nutrition values in', 
      'nutrients in', 
      'calories in', 
      'protein in', 
      'carbs in', 
      'fat in',
      'nutrition of',
      'nutrients of',
      'calories of',
      'protein of',
      'carbs of',
      'fat of'
    ];
    
    const hasNutritionFoodPhrase = nutritionFoodPhrases.some(phrase => text.toLowerCase().includes(phrase));
    
    // Consider it a nutrition analysis request if:
    // 1. It has nutrition keywords and question phrases, OR
    // 2. It has specific nutrition+food phrases (even without question words), OR
    // 3. It starts with "what are" and has nutrition keywords
    return (hasNutritionKeyword && hasQuestionPhrase) || 
           hasNutritionFoodPhrase ||
           (text.toLowerCase().startsWith('what are') && hasNutritionKeyword);
  };

  const handleGlucoseLogging = async (userInput: string) => {
    try {
      // Extract glucose value from input
      const glucoseMatch = userInput.match(/\b\d{2,3}\b/);
      if (glucoseMatch) {
        const glucoseValue = parseInt(glucoseMatch[0]);
        if (glucoseValue >= 50 && glucoseValue <= 500) {
          const response = await healthcareApi.logCGM(userId, glucoseValue);
          if (response.success) {
            toast({
              title: "Glucose Logged",
              description: response.message || "Your glucose reading has been recorded successfully."
            });
          }
          return response.message || `Glucose reading of ${glucoseValue} mg/dL logged successfully!`;
        } else {
          return 'Please provide a valid glucose value between 50-500 mg/dL.';
        }
      } else {
        return 'I couldn\'t find a valid glucose value in your message. Please include a number between 50-500 mg/dL.';
      }
    } catch (error) {
      console.error('Error logging glucose:', error);
      return 'Sorry, I couldn\'t log your glucose reading right now.';
    }
  };

  const handleMoodLogging = async (userInput: string) => {
    try {
      const response = await healthcareApi.logMood(userId, '', userInput);
      if (response.success) {
        toast({
          title: "Mood Logged",
          description: response.message || "Your mood has been recorded successfully."
        });
      }
      return response.message || 'Mood logged successfully!';
    } catch (error) {
      console.error('Error logging mood:', error);
      return 'Sorry, I couldn\'t log your mood right now.';
    }
  };

  const handleMealPlanning = async (requirements: string = '') => {
    try {
      setLoading(true);
      const response = await healthcareApi.generateMealPlan(userId, requirements);
      if (response.success) {
        toast({
          title: "Meal Plan Generated",
          description: response.message || "Your personalized meal plan is ready!"
        });
      }
      if (response.success && response.meal_plan) {
        const mealPlan = response.meal_plan;
        return `Here's your personalized meal plan:\n\n**Breakfast:** ${mealPlan.breakfast?.name}\n- ${mealPlan.breakfast?.description}\n\n**Lunch:** ${mealPlan.lunch?.name}\n- ${mealPlan.lunch?.description}\n\n**Dinner:** ${mealPlan.dinner?.name}\n- ${mealPlan.dinner?.description}\n\nWould you like me to adjust anything?`;
      } else {
        return 'Sorry, I couldn\'t generate a meal plan right now. Please try again later.';
      }
    } catch (error) {
      console.error('Error generating meal plan:', error);
      return 'Sorry, I couldn\'t generate a meal plan right now.';
    } finally {
      setLoading(false);
    }
  };

  const handleNutritionAnalysis = async (mealDescription: string) => {
    try {
      setLoading(true);
      // Extract the food item from the request
      // Look for patterns like "nutrition values in [food]" or "nutrients in [food]"
      let foodItem = mealDescription;
      
      const nutritionFoodPhrases = [
        'nutrition values in', 
        'nutrients in', 
        'calories in', 
        'protein in', 
        'carbs in', 
        'fat in',
        'nutrition of',
        'nutrients of',
        'calories of',
        'protein of',
        'carbs of',
        'fat of'
      ];
      
      for (const phrase of nutritionFoodPhrases) {
        if (mealDescription.toLowerCase().includes(phrase)) {
          const parts = mealDescription.split(phrase);
          if (parts.length > 1) {
            foodItem = parts[1].trim();
            break;
          }
        }
      }
      
      const response = await healthcareApi.logFood(userId, foodItem);
      if (response.success) {
        toast({
          title: "Food Logged",
          description: response.message || "Your meal has been logged successfully."
        });
      }
      if (response.success && response.nutrition_analysis) {
        const nutrition = response.nutrition_analysis;
        return `Nutrition analysis for "${foodItem}":

 Calories: ${nutrition.calories || 0}
 Protein: ${nutrition.protein || 0}g
 Carbs: ${nutrition.carbohydrates || 0}g
 Fat: ${nutrition.fat || 0}g

I've also logged this meal for you!`;
      } else {
        return 'Sorry, I couldn\'t analyze the nutrition right now.';
      }
    } catch (error) {
      console.error('Error analyzing nutrition:', error);
      return 'Sorry, I couldn\'t analyze the nutrition right now.';
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let assistantMessage: Message = { role: 'assistant', content: '' };

      // Check for specific commands
      if (isGlucoseLoggingRequest(input)) {
        const result = await handleGlucoseLogging(input);
        assistantMessage.content = result;
      } else if (isMoodLoggingRequest(input)) {
        const result = await handleMoodLogging(input);
        assistantMessage.content = result;
      } else if (isMealPlanningRequest(input)) {
        const result = await handleMealPlanning(input);
        assistantMessage.content = result;
      } else if (isNutritionAnalysisRequest(input)) {
        // Extract meal description for nutrition analysis
        const result = await handleNutritionAnalysis(input);
        assistantMessage.content = result;
      } else {
        // Use the existing interrupt agent for general queries
        const response = await healthcareApi.handleInterrupt(input, userId);
        assistantMessage.content = response.message || response.response || 'I\'m here to help!';
      }

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