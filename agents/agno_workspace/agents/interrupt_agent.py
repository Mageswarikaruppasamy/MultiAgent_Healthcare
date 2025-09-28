import os
from google import genai   # ✅ use google-genai
from typing import Dict, Any, List
import re

class InterruptAgent:
    def __init__(self):
        # Initialize Gemini API client
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY', 'YOUR_GEMINI_API_KEY_PLACEHOLDER')
        self.client = genai.Client(api_key=api_key)
        self.model_name = "gemini-2.5-flash"

        # Define FAQ knowledge base
        self.faq_db = {
            'diabetes': {
                'keywords': ['diabetes', 'blood sugar', 'glucose', 'insulin', 'diabetic'],
                'responses': [
                    "Diabetes management involves monitoring blood glucose, eating balanced meals, and following your healthcare provider's guidance.",
                    "For Type 2 diabetes, focus on fiber-rich foods, lean proteins, and complex carbohydrates while limiting simple sugars.",
                    "Regular glucose monitoring helps track how different foods and activities affect your blood sugar levels."
                ]
            },
            'hypertension': {
                'keywords': ['blood pressure', 'hypertension', 'high blood pressure', 'bp'],
                'responses': [
                    "Managing blood pressure often involves reducing sodium intake, eating potassium-rich foods, and maintaining a healthy weight.",
                    "The DASH diet (rich in fruits, vegetables, and low-fat dairy) is particularly beneficial for blood pressure management.",
                    "Regular exercise and stress management are important components of blood pressure control."
                ]
            },
            'nutrition': {
                'keywords': ['calories', 'macros', 'protein', 'carbs', 'fat', 'vitamins', 'minerals'],
                'responses': [
                    "A balanced diet typically includes 45-65% carbohydrates, 20-35% fats, and 10-35% protein.",
                    "Focus on whole foods: fruits, vegetables, lean proteins, whole grains, and healthy fats.",
                    "Portion control and meal timing can be as important as food choices for health management."
                ]
            },
            'mood': {
                'keywords': ['mood', 'depression', 'anxiety', 'stress', 'mental health'],
                'responses': [
                    "Diet can significantly impact mood. Foods rich in omega-3s, complex carbohydrates, and B-vitamins may help.",
                    "Regular meal timing helps maintain stable blood sugar, which can support mood stability.",
                    "If you're experiencing persistent mood changes, consider speaking with a healthcare professional."
                ]
            },
            'exercise': {
                'keywords': ['exercise', 'workout', 'physical activity', 'fitness'],
                'responses': [
                    "Regular physical activity helps with glucose control, mood improvement, and overall health.",
                    "Even light activities like walking after meals can help with blood sugar management.",
                    "Always consult your healthcare provider before starting a new exercise program, especially with medical conditions."
                ]
            }
        }
    
    def classify_question_type(self, query: str) -> str:
        """Classify the type of question to determine response strategy"""
        query_lower = query.lower()
        
        # Check for FAQ topics first
        for topic, data in self.faq_db.items():
            if any(keyword in query_lower for keyword in data['keywords']):
                return f"faq_{topic}"
        
        # Check for general health questions
        health_keywords = ['health', 'medical', 'doctor', 'symptoms', 'treatment', 'medication']
        if any(keyword in query_lower for keyword in health_keywords):
            return 'health_general'
        
        # Check for app-specific questions
        app_keywords = ['how to use', 'navigate', 'feature', 'function', 'help with app']
        if any(keyword in query_lower for keyword in app_keywords):
            return 'app_help'
        
        # Default to general knowledge
        return 'general_knowledge'
    
    def get_faq_response(self, topic: str, query: str) -> str:
        """Get response from FAQ database"""
        topic_key = topic.replace('faq_', '')
        if topic_key in self.faq_db:
            responses = self.faq_db[topic_key]['responses']
            return responses[0]
        return None
    
    def get_llm_response(self, query: str, context: Dict[str, Any] = None) -> str:
        """Get response from Gemini LLM"""
        system_prompt = """
        You are a helpful healthcare assistant focused on general wellness, nutrition, and healthy lifestyle guidance. 
        
        Guidelines:
        - Provide helpful, accurate information about nutrition, wellness, and general health topics
        - Always remind users that your advice doesn't replace professional medical consultation
        - Be encouraging and supportive
        - Keep responses concise but informative (2-3 sentences)
        - If asked about specific medical conditions or treatments, recommend consulting healthcare providers
        - Focus on evidence-based wellness practices
        
        Context: This is part of a healthcare tracking application where users log mood, glucose readings, food intake, and get meal plans.
        """
        
        prompt = f"{system_prompt}\n\nUser question: {query}\n\nProvide a helpful response:"
        
        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )
            return response.text.strip()
        except Exception as e:
            print(f"LLM response error: {e}")
            return "I'm having trouble processing your question right now. Please try rephrasing or ask about specific topics like nutrition, mood, or glucose monitoring."
    
    def get_app_help_response(self, query: str) -> str:
        """Provide help with app functionality"""
        help_responses = {
            'mood': "To track your mood, simply click on one of the emoji buttons that represents how you're feeling. I'll track your mood patterns over time!",
            'glucose': "For glucose monitoring, you can either enter a reading manually or let me generate a realistic reading based on your health profile.",
            'food': "To log food, describe what you ate in the text box - be as detailed as possible! I'll analyze the nutrition content for you.",
            'meal plan': "To generate a meal plan, click the 'Generate Meal Plan' button. I'll create personalized recommendations based on your dietary preferences and health data.",
            'general': "I can help you track mood, monitor glucose, log food intake, and generate personalized meal plans. Just ask me about any of these features!"
        }
        
        query_lower = query.lower()
        if 'mood' in query_lower:
            return help_responses['mood']
        elif any(word in query_lower for word in ['glucose', 'blood sugar', 'cgm']):
            return help_responses['glucose']
        elif any(word in query_lower for word in ['food', 'meal', 'eat']):
            return help_responses['food']
        elif 'meal plan' in query_lower:
            return help_responses['meal plan']
        else:
            return help_responses['general']
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        query = inputs.get('query', '').strip()
        current_context = inputs.get('current_context', {})
        
        if not query:
            return {
                'success': False,
                'message': 'Please ask me a question!',
                'error': 'empty_query'
            }
        
        # Classify question type
        question_type = self.classify_question_type(query)
        
        # Generate appropriate response
        if question_type.startswith('faq_'):
            response = self.get_faq_response(question_type, query)
            response_source = 'faq'
        elif question_type == 'app_help':
            response = self.get_app_help_response(query)
            response_source = 'app_help'
        elif question_type == 'health_general':
            response = self.get_llm_response(query, current_context)
            response_source = 'llm_health'
        else:
            response = self.get_llm_response(query, current_context)
            response_source = 'llm_general'
        
        # Add disclaimer for health-related questions
        if question_type in ['health_general'] or question_type.startswith('faq_'):
            response += "\n\n💡 Remember: This information is for educational purposes only and doesn't replace professional medical advice."
        
        # Add navigation help
        navigation_prompt = self.get_navigation_suggestion(current_context)
        
        return {
            'success': True,
            'message': response,
            'question_type': question_type,
            'response_source': response_source,
            'navigation_suggestion': navigation_prompt,
            'continue_flow': True
        }
    
    def get_navigation_suggestion(self, current_context: Dict[str, Any]) -> str:
        """Suggest next actions based on current context"""
        active_agent = current_context.get('active_agent')
        
        suggestions = {
            'mood_tracker': "Would you like to continue tracking your mood or explore other features?",
            'cgm_agent': "Would you like to log another glucose reading or check your trends?",
            'food_intake': "Would you like to log more food items or generate a meal plan?",
            'meal_planner': "Would you like to modify your meal plan or track your food intake?",
            'greeting': "How would you like to start? You can track mood, log glucose, record food, or get meal recommendations!",
            'default': "Is there anything else I can help you with? I'm here for mood tracking, glucose monitoring, food logging, and meal planning!"
        }
        
        return suggestions.get(active_agent, suggestions['default'])


# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "interrupt_agent",
    "version": "1.0.0",
    "description": "Handles general Q&A and interrupts during any flow",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID",
            "required": False
        },
        "query": {
            "type": "string",
            "description": "User's question or query",
            "required": True
        },
        "current_context": {
            "type": "object",
            "description": "Current conversation context",
            "required": False
        }
    },
    "outputs": {
        "success": {
            "type": "boolean",
            "description": "Whether the query was processed successfully"
        },
        "message": {
            "type": "string",
            "description": "Response to the user's query"
        },
        "question_type": {
            "type": "string",
            "description": "Classified type of question"
        },
        "response_source": {
            "type": "string",
            "description": "Source of the response (faq, llm, app_help)"
        },
        "navigation_suggestion": {
            "type": "string",
            "description": "Suggestion for next actions"
        },
        "continue_flow": {
            "type": "boolean",
            "description": "Whether user can continue with previous task"
        }
    }
}
