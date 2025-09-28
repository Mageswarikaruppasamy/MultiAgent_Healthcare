# agents/agno_workspace/agents/mood_tracker_agent.py
import sqlite3
import os
from typing import Dict, Any, List
from datetime import datetime, timedelta

class MoodTrackerAgent:
    def __init__(self):
        self.db_path = os.getenv('DATABASE_PATH', '../../../data/healthcare_data.db')
        self.mood_values = {
            'happy': 3,
            'tired': 2,
            'anxious': 2,
            'calm': 1,
            'sad': 1,
            'angry': 1
        }
    
    def get_database_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def log_mood(self, user_id: int, mood: str) -> bool:
        """Log user mood to database"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO mood_logs (user_id, mood)
                VALUES (?, ?)
            ''', (user_id, mood.lower()))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Database error logging mood: {e}")
            return False
    
    def get_mood_history(self, user_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get mood history for specified number of days"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT mood, timestamp FROM mood_logs 
                WHERE user_id = ? AND timestamp >= datetime('now', '-{} days')
                ORDER BY timestamp DESC
            '''.format(days), (user_id,))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'mood': result[0],
                    'timestamp': result[1],
                    'score': self.mood_values.get(result[0], 3)
                }
                for result in results
            ]
        except Exception as e:
            print(f"Database error retrieving mood history: {e}")
            return []
    
    def calculate_mood_stats(self, mood_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate mood statistics"""
        if not mood_history:
            return {
                'average_score': 3.0,
                'trend': 'stable',
                'dominant_mood': 'neutral',
                'total_entries': 0
            }
        
        scores = [entry['score'] for entry in mood_history]
        average_score = sum(scores) / len(scores)
        
        # Calculate trend (comparing first half with second half)
        if len(scores) >= 4:
            mid_point = len(scores) // 2
            recent_avg = sum(scores[:mid_point]) / mid_point
            older_avg = sum(scores[mid_point:]) / (len(scores) - mid_point)
            
            if recent_avg > older_avg + 0.5:
                trend = 'improving'
            elif recent_avg < older_avg - 0.5:
                trend = 'declining'
            else:
                trend = 'stable'
        else:
            trend = 'stable'
        
        # Find dominant mood
        mood_counts = {}
        for entry in mood_history:
            mood = entry['mood']
            mood_counts[mood] = mood_counts.get(mood, 0) + 1
        
        dominant_mood = max(mood_counts.items(), key=lambda x: x[1])[0] if mood_counts else 'neutral'
        
        return {
            'average_score': round(average_score, 1),
            'trend': trend,
            'dominant_mood': dominant_mood,
            'total_entries': len(mood_history)
        }
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        mood = inputs.get('mood')
        action = inputs.get('action', 'log')  # 'log' or 'get_stats'
        
        if not user_id:
            return {
                'success': False,
                'message': 'User ID is required',
                'error': 'missing_user_id'
            }
        
        if action == 'log':
            if not mood:
                return {
                    'success': False,
                    'message': 'Please select your current mood',
                    'available_moods': list(self.mood_values.keys())
                }
            
            # Validate mood
            if mood.lower() not in self.mood_values:
                return {
                    'success': False,
                    'message': f'Invalid mood "{mood}". Please select from available options.',
                    'available_moods': list(self.mood_values.keys())
                }
            
            # Log mood
            success = self.log_mood(user_id, mood)
            if not success:
                return {
                    'success': False,
                    'message': 'Failed to log mood. Please try again.',
                    'error': 'database_error'
                }
            
            # Get updated stats
            mood_history = self.get_mood_history(user_id)
            mood_stats = self.calculate_mood_stats(mood_history)
            
            return {
                'success': True,
                'message': f'Great! I\'ve logged that you\'re feeling {mood}. {self.get_mood_response(mood, mood_stats)}',
                'logged_mood': mood,
                'mood_stats': mood_stats,
                'mood_history': mood_history[-7:]  # Last 7 entries
            }
        
        elif action == 'get_stats':
            mood_history = self.get_mood_history(user_id)
            mood_stats = self.calculate_mood_stats(mood_history)
            
            return {
                'success': True,
                'message': self.generate_mood_summary(mood_stats),
                'mood_stats': mood_stats,
                'mood_history': mood_history
            }
        
        else:
            return {
                'success': False,
                'message': 'Invalid action. Use "log" or "get_stats".',
                'error': 'invalid_action'
            }
    
    def get_mood_response(self, mood: str, stats: Dict[str, Any]) -> str:
        """Generate contextual response based on mood and trends"""
        trend = stats.get('trend', 'stable')
        avg_score = stats.get('average_score', 3.0)
        
        responses = {
            'happy': "That's wonderful! 😊",
            'tired': "Rest is important. Consider taking some time to recharge. 😴",
            'anxious': "I understand anxiety can be challenging. Remember to breathe deeply. 💙",
            'stressed': "Stress can be tough. Would you like some meal suggestions that might help? 🫖",
            'sad': "I'm sorry you're feeling down. You're not alone in this. 💚",
            'angry': "It's okay to feel angry sometimes. Let's focus on self-care. 🌸"
        }
        
        base_response = responses.get(mood.lower(), "Thanks for sharing how you're feeling. ")
        
        if trend == 'improving':
            base_response += " Your mood trend has been improving lately - that's fantastic!"
        elif trend == 'declining' and avg_score < 3:
            base_response += " I've noticed your mood has been lower recently. Would you like to talk about meal planning to boost your energy?"
        
        return base_response
    
    def generate_mood_summary(self, stats: Dict[str, Any]) -> str:
        """Generate mood summary message"""
        avg_score = stats['average_score']
        trend = stats['trend']
        dominant_mood = stats['dominant_mood']
        total_entries = stats['total_entries']
        
        if total_entries == 0:
            return "You haven't logged any moods yet. Start tracking to see your patterns!"
        
        summary = f"📊 Your mood summary over the last 7 days:\n\n"
        summary += f"• Average mood score: {avg_score}/5\n"
        summary += f"• Trend: {trend.title()}\n"
        summary += f"• Most common mood: {dominant_mood.title()}\n"
        summary += f"• Total entries: {total_entries}\n\n"
        
        if avg_score >= 4:
            summary += "🌟 You're doing great! Keep up the positive energy!"
        elif avg_score >= 3:
            summary += "👍 Your mood is fairly balanced. Consider what activities make you feel best."
        else:
            summary += "💙 Your mood has been lower lately. Remember that it's okay to have ups and downs. Consider focusing on self-care activities."
        
        return summary

# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "mood_tracker_agent",
    "version": "1.0.0",
    "description": "Tracks user mood and computes rolling averages",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID",
            "required": True
        },
        "mood": {
            "type": "string",
            "description": "User's current mood",
            "enum": ["happy", "sad", "tired", "anxious", "calm", "energetic", "angry"],
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
        "logged_mood": {
            "type": "string",
            "description": "The mood that was logged"
        },
        "mood_stats": {
            "type": "object",
            "description": "Mood statistics and trends"
        },
        "mood_history": {
            "type": "array",
            "description": "Recent mood history"
        }
    }
}