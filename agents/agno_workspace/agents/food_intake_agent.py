# agents/agno_workspace/agents/food_intake_agent.py

import sqlite3
import os
from google import genai   # ✅ using google-genai SDK
from typing import Dict, Any, List
import json
import re
from datetime import datetime

class FoodIntakeAgent:
    def __init__(self):
        self.db_path = os.getenv('DATABASE_PATH', '../../../data/healthcare_data.db')

        # Initialize Gemini API client using .env key
        api_key = os.getenv('GEMINI_API_KEY') or os.getenv('GOOGLE_API_KEY', 'YOUR_GEMINI_API_KEY_PLACEHOLDER')
        self.client = genai.Client(api_key=api_key)

        # pick model
        self.model_name = "gemini-2.5-flash"

    def get_database_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)

    def analyze_nutrition_with_llm(self, meal_description: str) -> Dict[str, float]:
        """Use Gemini to analyze nutritional content of meal description"""
        prompt = f"""
        Analyze the following meal/food description and estimate the nutritional content. 
        Provide your response in JSON format with the following fields:
        - carbs: estimated carbohydrates in grams
        - protein: estimated protein in grams  
        - fat: estimated fat in grams
        - calories: estimated total calories
        - confidence: confidence level (1-10)

        Meal description: "{meal_description}"

        Please be realistic in your estimates. If the description is vague, make reasonable assumptions for a typical serving.
        Return only the JSON response, no additional text.
        """

        try:
            response = self.client.models.generate_content(
                model=self.model_name,
                contents=prompt
            )

            response_text = response.text.strip()
            json_match = re.search(r'\{.*\}', response_text, re.DOTALL)

            if json_match:
                nutrition_data = json.loads(json_match.group(0))
                # Ensure all values are valid floats
                return {
                    'carbs': float(nutrition_data.get('carbs', 0)) if nutrition_data.get('carbs') is not None else 0.0,
                    'protein': float(nutrition_data.get('protein', 0)) if nutrition_data.get('protein') is not None else 0.0,
                    'fat': float(nutrition_data.get('fat', 0)) if nutrition_data.get('fat') is not None else 0.0,
                    'calories': float(nutrition_data.get('calories', 0)) if nutrition_data.get('calories') is not None else 0.0,
                    'confidence': float(nutrition_data.get('confidence', 5)) if nutrition_data.get('confidence') is not None else 5.0
                }
            else:
                return self.simple_nutrition_estimation(meal_description)

        except Exception as e:
            print(f"LLM nutrition analysis error: {e}")
            return self.simple_nutrition_estimation(meal_description)
    
    def simple_nutrition_estimation(self, meal_description: str) -> Dict[str, float]:
        """Simple keyword-based nutrition estimation as fallback"""
        description_lower = meal_description.lower()
        
        # Basic estimates based on common foods
        carbs = 30.0  # default
        protein = 15.0  # default
        fat = 10.0  # default
        
        # Carb-rich foods
        carb_foods = ['rice', 'bread', 'pasta', 'potato', 'oats', 'cereal', 'fruit', 'sugar']
        for food in carb_foods:
            if food in description_lower:
                carbs += 20.0
        
        # Protein-rich foods
        protein_foods = ['chicken', 'beef', 'fish', 'egg', 'tofu', 'beans', 'lentil', 'protein']
        for food in protein_foods:
            if food in description_lower:
                protein += 20.0
        
        # Fat-rich foods
        fat_foods = ['oil', 'butter', 'nuts', 'cheese', 'avocado', 'fried']
        for food in fat_foods:
            if food in description_lower:
                fat += 15.0
        
        calories = (carbs * 4.0) + (protein * 4.0) + (fat * 9.0)
        
        return {
            'carbs': float(carbs),
            'protein': float(protein),
            'fat': float(fat),
            'calories': float(calories),
            'confidence': 5.0
        }
    
    def log_food_intake(self, user_id: int, meal_description: str, nutrition_data: Dict[str, float]) -> bool:
        """Log food intake to database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO food_logs (user_id, meal_description, estimated_calories,
                                     estimated_carbs, estimated_protein, estimated_fat)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (user_id, meal_description, nutrition_data['calories'],
                  nutrition_data['carbs'], nutrition_data['protein'], nutrition_data['fat']))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Database error logging food: {e}")
            return False
    
    def get_food_history(self, user_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get food intake history for specified number of days"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT meal_description, estimated_calories, estimated_carbs, estimated_protein, 
                       estimated_fat, timestamp FROM food_logs 
                WHERE user_id = ? AND timestamp >= datetime('now', '-{} days')
                ORDER BY timestamp DESC
            '''.format(days), (user_id,))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'meal_description': result[0],
                    'calories': result[1],
                    'carbs': result[2],
                    'protein': result[3],
                    'fat': result[4],
                    'timestamp': result[5]
                }
                for result in results
            ]
        except Exception as e:
            print(f"Database error retrieving food history: {e}")
            return []
    
    def calculate_nutrition_stats(self, food_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate nutrition statistics"""
        if not food_history:
            return {
                'total_entries': 0,
                'daily_averages': {
                    'calories': 0,
                    'carbs': 0,
                    'protein': 0,
                    'fat': 0
                }
            }
        
        total_calories = sum(entry['calories'] for entry in food_history)
        total_carbs = sum(entry['carbs'] for entry in food_history)
        total_protein = sum(entry['protein'] for entry in food_history)
        total_fat = sum(entry['fat'] for entry in food_history)
        
        # Estimate days covered (rough approximation)
        days_covered = max(1, len(food_history) // 3)  # Assume ~3 meals per day
        
        return {
            'total_entries': len(food_history),
            'days_covered': days_covered,
            'daily_averages': {
                'calories': round(total_calories / days_covered, 1),
                'carbs': round(total_carbs / days_covered, 1),
                'protein': round(total_protein / days_covered, 1),
                'fat': round(total_fat / days_covered, 1)
            },
            'totals': {
                'calories': round(total_calories, 1),
                'carbs': round(total_carbs, 1),
                'protein': round(total_protein, 1),
                'fat': round(total_fat, 1)
            }
        }
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        meal_description = inputs.get('meal_description')
        action = inputs.get('action', 'log')  # 'log' or 'get_stats'
        
        if not user_id:
            return {
                'success': False,
                'message': 'User ID is required',
                'error': 'missing_user_id'
            }
        
        if action == 'log':
            if not meal_description or not meal_description.strip():
                return {
                    'success': False,
                    'message': 'Please describe what you ate or drank',
                    'error': 'missing_meal_description'
                }
            
            # Analyze nutrition content using LLM
            nutrition_data = self.analyze_nutrition_with_llm(meal_description)
            
            # Log to database
            success = self.log_food_intake(user_id, meal_description, nutrition_data)
            if not success:
                return {
                    'success': False,
                    'message': 'Failed to log food intake. Please try again.',
                    'error': 'database_error'
                }
            
            return {
                'success': True,
                'message': self.generate_food_response(meal_description, nutrition_data),
                'meal_description': meal_description,
                'nutrition_analysis': nutrition_data,
                'recommendations': self.get_nutrition_recommendations(nutrition_data)
            }
        
        elif action == 'get_stats':
            food_history = self.get_food_history(user_id)
            nutrition_stats = self.calculate_nutrition_stats(food_history)
            
            return {
                'success': True,
                'message': self.generate_nutrition_summary(nutrition_stats),
                'nutrition_stats': nutrition_stats,
                'recent_meals': food_history[:10]  # Last 10 meals
            }
        
        else:
            return {
                'success': False,
                'message': 'Invalid action. Use "log" or "get_stats".',
                'error': 'invalid_action'
            }
    
    def generate_food_response(self, meal_description: str, nutrition_data: Dict[str, float]) -> str:
        """Generate response after logging food"""
        confidence = nutrition_data.get('confidence', 5)
        
        response = f"✅ Logged: {meal_description}\n\n"
        response += f"📊 Estimated nutrition:\n"
        response += f"• Calories: {nutrition_data['calories']:.0f}\n"
        response += f"• Carbs: {nutrition_data['carbs']:.1f}g\n"
        response += f"• Protein: {nutrition_data['protein']:.1f}g\n"
        response += f"• Fat: {nutrition_data['fat']:.1f}g\n"
        
        if confidence < 6:
            response += f"\n💡 Note: This is an estimate based on your description. For more accurate tracking, try to include portion sizes!"
        
        return response
    
    def get_nutrition_recommendations(self, nutrition_data: Dict[str, float]) -> List[str]:
        """Get recommendations based on nutrition analysis"""
        recommendations = []
        
        carbs = nutrition_data['carbs']
        protein = nutrition_data['protein']
        fat = nutrition_data['fat']
        calories = nutrition_data['calories']
        
        # Carb recommendations
        if carbs > 60:
            recommendations.append("High carb content - consider pairing with protein for better blood sugar control")
        elif carbs < 15:
            recommendations.append("Low carb meal - great for blood sugar stability")
        
        # Protein recommendations
        if protein > 25:
            recommendations.append("Excellent protein content - great for muscle health and satiety")
        elif protein < 10:
            recommendations.append("Consider adding more protein to help with satiety and blood sugar control")
        
        # Calorie recommendations
        if calories > 600:
            recommendations.append("This is a substantial meal - consider lighter options for your next eating occasion")
        elif calories < 200:
            recommendations.append("Light meal - you might want to have a healthy snack later if needed")
        
        if not recommendations:
            recommendations.append("Balanced meal - keep up the good work!")
        
        return recommendations
    
    def generate_nutrition_summary(self, stats: Dict[str, Any]) -> str:
        """Generate nutrition summary message"""
        if stats['total_entries'] == 0:
            return "No food entries logged yet. Start tracking to see your nutrition patterns!"
        
        daily_avg = stats['daily_averages']
        days_covered = stats['days_covered']
        
        summary = f"📊 Your nutrition summary over the last {days_covered} days:\n\n"
        summary += f"• Daily average calories: {daily_avg['calories']:.0f}\n"
        summary += f"• Daily average carbs: {daily_avg['carbs']:.1f}g\n"
        summary += f"• Daily average protein: {daily_avg['protein']:.1f}g\n"
        summary += f"• Daily average fat: {daily_avg['fat']:.1f}g\n"
        summary += f"• Total meals logged: {stats['total_entries']}\n\n"
        
        # Add recommendations based on averages
        if daily_avg['protein'] < 50:
            summary += "💡 Consider increasing protein intake for better satiety and muscle health.\n"
        if daily_avg['calories'] > 2500:
            summary += "💡 Your calorie intake is quite high - consider portion control strategies.\n"
        elif daily_avg['calories'] < 1200:
            summary += "💡 Your calorie intake might be too low - ensure you're eating enough for your needs.\n"
        else:
            summary += "✅ Your nutrition tracking shows good awareness of your eating patterns!\n"
        
        return summary

# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "food_intake_agent",
    "version": "1.0.0",
    "description": "Records meals/snacks and estimates nutritional content",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID",
            "required": True
        },
        "meal_description": {
            "type": "string",
            "description": "Description of the meal or snack",
            "required": False
        },
        "action": {
            "type": "string",
            "description": "Action to perform",
            "enum": ["log", "get_stats"],
            "default": "log"
        }
    },
    "outputs": {
        "success": {
            "type": "boolean",
            "description": "Whether the operation was successful"
        },
        "message": {
            "type": "string",
            "description": "Response message"
        },
        "meal_description": {
            "type": "string",
            "description": "The meal that was logged"
        },
        "nutrition_analysis": {
            "type": "object",
            "description": "Nutritional analysis of the meal"
        },
        "recommendations": {
            "type": "array",
            "description": "Nutrition recommendations"
        }
    }
}