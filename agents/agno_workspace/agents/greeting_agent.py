# agents/agno_workspace/agents/greeting_agent.py
import sqlite3
import json
import os
from typing import Dict, Any

class GreetingAgent:
    def __init__(self):
        self.db_path = os.getenv('DATABASE_PATH', '../../data/healthcare_data.db')
    
    def get_database_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def validate_user_id(self, user_id: int) -> bool:
        """Validate if user ID exists in database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('SELECT COUNT(*) FROM users WHERE id = ?', (user_id,))
            count = cursor.fetchone()[0]
            conn.close()
            return count > 0
        except Exception as e:
            print(f"Database error: {e}")
            return False
    
    def get_user_info(self, user_id: int) -> Dict[str, Any]:
        """Get user information from database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT first_name, last_name, city, dietary_preference, 
                       medical_conditions, physical_limitations
                FROM users WHERE id = ?
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return {
                    'first_name': result[0],
                    'last_name': result[1],
                    'city': result[2],
                    'dietary_preference': result[3],
                    'medical_conditions': json.loads(result[4]),
                    'physical_limitations': json.loads(result[5])
                }
            return None
        except Exception as e:
            print(f"Database error: {e}")
            return None
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        
        if not user_id:
            return {
                'success': False,
                'message': 'Please provide a valid user ID to continue.',
                'action': 'request_user_id'
            }
        
        # Validate user ID
        if not self.validate_user_id(user_id):
            return {
                'success': False,
                'message': f'User ID {user_id} not found. Please enter a valid user ID (1-100).',
                'action': 'request_user_id'
            }
        
        # Get user information
        user_info = self.get_user_info(user_id)
        if not user_info:
            return {
                'success': False,
                'message': 'Unable to retrieve user information. Please try again.',
                'action': 'request_user_id'
            }
        
        # Generate personalized greeting
        greeting_message = self.generate_greeting(user_info)
        
        return {
            'success': True,
            'message': greeting_message,
            'user_info': user_info,
            'action': 'show_dashboard'
        }
    
    def generate_greeting(self, user_info: Dict[str, Any]) -> str:
        """Generate personalized greeting message"""
        first_name = user_info['first_name']
        city = user_info['city']
        dietary_pref = user_info['dietary_preference']
        
        # Create contextual greeting based on user's profile
        medical_conditions = user_info['medical_conditions']
        has_diabetes = 'Type 2 Diabetes' in medical_conditions
        has_hypertension = 'Hypertension' in medical_conditions
        
        greeting = f"Hello {first_name}! 👋 Welcome to your personalized health companion.\n\n"
        greeting += f"I see you're joining us from {city}. "
        
        if dietary_pref != "non-vegetarian":
            greeting += f"Great to have another {dietary_pref} user! "
        
        if has_diabetes or has_hypertension:
            greeting += "I'm here to help you manage your health with personalized meal planning and glucose monitoring. "
        else:
            greeting += "I'm here to help you maintain optimal health with mood tracking and personalized meal planning. "
        
        greeting += "\n\nHow can I assist you today? I can help you with:\n"
        greeting += "🎭 Mood tracking\n"
        greeting += "📊 Glucose monitoring\n" 
        greeting += "🍽️ Food logging\n"
        greeting += "📋 Meal planning\n"
        greeting += "❓ General health questions"
        
        return greeting

# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "greeting_agent",
    "version": "1.0.0",
    "description": "Greets users personally and validates user ID",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID to validate and greet",
            "required": True
        }
    },
    "outputs": {
        "success": {
            "type": "boolean",
            "description": "Whether the greeting was successful"
        },
        "message": {
            "type": "string",
            "description": "Greeting message or error message"
        },
        "user_info": {
            "type": "object",
            "description": "User information if successful"
        },
        "action": {
            "type": "string",
            "description": "Next action to take"
        }
    }
}