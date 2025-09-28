# agents/agno_workspace/agents/cgm_agent.py
import sqlite3
import os
import random
import json
from typing import Dict, Any, List
from datetime import datetime, timedelta

class CGMAgent:
    def __init__(self):
        self.db_path = os.getenv('DATABASE_PATH', '../../../data/healthcare_data.db')
        self.normal_range = (80, 180)
        self.critical_low = 70
        self.critical_high = 300
    
    def get_database_connection(self):
        """Get database connection"""
        return sqlite3.connect(self.db_path)
    
    def get_user_baseline(self, user_id: int) -> tuple:
        """Get user's baseline glucose range"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT baseline_glucose_min, baseline_glucose_max, medical_conditions
                FROM users WHERE id = ?
            ''', (user_id,))
            
            result = cursor.fetchone()
            conn.close()
            
            if result:
                return result[0], result[1], json.loads(result[2])
            return self.normal_range[0], self.normal_range[1], []
        except Exception as e:
            print(f"Database error getting baseline: {e}")
            return self.normal_range[0], self.normal_range[1], []
    
    def generate_realistic_reading(self, user_id: int) -> int:
        """Generate realistic CGM reading based on user's medical condition"""
        min_glucose, max_glucose, medical_conditions = self.get_user_baseline(user_id)
        
        # Base reading around user's typical range
        base_reading = random.randint(min_glucose, max_glucose)
        
        # Add some natural variation
        variation = random.randint(-20, 30)
        reading = base_reading + variation
        
        # Ensure within absolute bounds
        reading = max(60, min(350, reading))
        
        # If diabetic, occasionally spike higher
        if "Type 2 Diabetes" in medical_conditions and random.random() < 0.2:
            reading += random.randint(20, 60)
        
        return reading
    
    def log_cgm_reading(self, user_id: int, glucose_reading: int) -> bool:
        """Log CGM reading to database"""
        try:
            alert_flag = glucose_reading < self.critical_low or glucose_reading > self.critical_high
            
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO cgm_readings (user_id, glucose_reading, alert_flag)
                VALUES (?, ?, ?)
            ''', (user_id, glucose_reading, alert_flag))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            print(f"Database error logging CGM: {e}")
            return False
    
    def get_cgm_history(self, user_id: int, days: int = 7) -> List[Dict[str, Any]]:
        """Get CGM history for specified number of days"""
        try:
            conn = self.get_database_connection()
            cursor = conn.cursor()
            cursor.execute('''
                SELECT glucose_reading, alert_flag, timestamp FROM cgm_readings 
                WHERE user_id = ? AND timestamp >= datetime('now', '-{} days')
                ORDER BY timestamp DESC
            '''.format(days), (user_id,))
            
            results = cursor.fetchall()
            conn.close()
            
            return [
                {
                    'glucose_reading': result[0],
                    'alert_flag': bool(result[1]),
                    'timestamp': result[2],
                    'status': self.get_glucose_status(result[0])
                }
                for result in results
            ]
        except Exception as e:
            print(f"Database error retrieving CGM history: {e}")
            return []
    
    def get_glucose_status(self, reading: int) -> str:
        """Determine glucose status based on reading"""
        if reading < 70:
            return 'critically_low'
        elif reading < 80:
            return 'low'
        elif reading <= 140:
            return 'normal'
        elif reading <= 180:
            return 'elevated'
        elif reading <= 250:
            return 'high'
        else:
            return 'critically_high'
    
    def calculate_cgm_stats(self, cgm_history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate CGM statistics"""
        if not cgm_history:
            return {
                'average_reading': 0,
                'time_in_range': 0,
                'total_readings': 0,
                'trend': 'stable',
                'alerts': 0
            }
        
        readings = [entry['glucose_reading'] for entry in cgm_history]
        average_reading = sum(readings) / len(readings)
        
        # Time in range (70-180)
        in_range_count = sum(1 for reading in readings if 70 <= reading <= 180)
        time_in_range = (in_range_count / len(readings)) * 100
        
        # Count alerts
        alerts = sum(1 for entry in cgm_history if entry['alert_flag'])
        
        # Calculate trend
        if len(readings) >= 4:
            mid_point = len(readings) // 2
            recent_avg = sum(readings[:mid_point]) / mid_point
            older_avg = sum(readings[mid_point:]) / (len(readings) - mid_point)
            
            if recent_avg > older_avg + 15:
                trend = 'rising'
            elif recent_avg < older_avg - 15:
                trend = 'falling'
            else:
                trend = 'stable'
        else:
            trend = 'stable'
        
        return {
            'average_reading': round(average_reading, 1),
            'time_in_range': round(time_in_range, 1),
            'total_readings': len(readings),
            'trend': trend,
            'alerts': alerts
        }
    
    def process(self, inputs: Dict[str, Any]) -> Dict[str, Any]:
        """Main processing function"""
        user_id = inputs.get('user_id')
        glucose_reading = inputs.get('glucose_reading')
        action = inputs.get('action', 'log')  # 'log', 'generate', or 'get_stats'
        
        if not user_id:
            return {
                'success': False,
                'message': 'User ID is required',
                'error': 'missing_user_id'
            }
        
        if action == 'generate':
            # Generate realistic reading based on user's condition
            generated_reading = self.generate_realistic_reading(user_id)
            success = self.log_cgm_reading(user_id, generated_reading)
            
            if not success:
                return {
                    'success': False,
                    'message': 'Failed to log generated reading. Please try again.',
                    'error': 'database_error'
                }
            
            status = self.get_glucose_status(generated_reading)
            alert_flag = generated_reading < self.critical_low or generated_reading > self.critical_high
            
            return {
                'success': True,
                'message': self.get_reading_response(generated_reading, status, alert_flag),
                'glucose_reading': generated_reading,
                'status': status,
                'alert_flag': alert_flag,
                'recommendations': self.get_recommendations(generated_reading, status)
            }
        
        elif action == 'log':
            if glucose_reading is None:
                return {
                    'success': False,
                    'message': 'Please provide a glucose reading (80-300 mg/dL)',
                    'error': 'missing_reading'
                }
            
            # Validate reading range
            if not (60 <= glucose_reading <= 350):
                return {
                    'success': False,
                    'message': 'Glucose reading must be between 60 and 350 mg/dL',
                    'error': 'invalid_range'
                }
            
            success = self.log_cgm_reading(user_id, glucose_reading)
            if not success:
                return {
                    'success': False,
                    'message': 'Failed to log reading. Please try again.',
                    'error': 'database_error'
                }
            
            status = self.get_glucose_status(glucose_reading)
            alert_flag = glucose_reading < self.critical_low or glucose_reading > self.critical_high
            
            return {
                'success': True,
                'message': self.get_reading_response(glucose_reading, status, alert_flag),
                'glucose_reading': glucose_reading,
                'status': status,
                'alert_flag': alert_flag,
                'recommendations': self.get_recommendations(glucose_reading, status)
            }
        
        elif action == 'get_stats':
            cgm_history = self.get_cgm_history(user_id)
            cgm_stats = self.calculate_cgm_stats(cgm_history)
            
            return {
                'success': True,
                'message': self.generate_cgm_summary(cgm_stats),
                'cgm_stats': cgm_stats,
                'cgm_history': cgm_history
            }
        
        else:
            return {
                'success': False,
                'message': 'Invalid action. Use "log", "generate", or "get_stats".',
                'error': 'invalid_action'
            }
    
    def get_reading_response(self, reading: int, status: str, alert_flag: bool) -> str:
        """Generate response based on glucose reading"""
        responses = {
            'critically_low': f"⚠️ ALERT: Your glucose is critically low at {reading} mg/dL. Please consume fast-acting carbs immediately and contact your healthcare provider!",
            'low': f"📉 Your glucose is low at {reading} mg/dL. Consider having a small snack with carbs.",
            'normal': f"✅ Great! Your glucose is in normal range at {reading} mg/dL.",
            'elevated': f"📈 Your glucose is slightly elevated at {reading} mg/dL. This is manageable with proper meal planning.",
            'high': f"⚠️ Your glucose is high at {reading} mg/dL. Consider adjusting your next meal and increasing water intake.",
            'critically_high': f"🚨 ALERT: Your glucose is critically high at {reading} mg/dL. Please contact your healthcare provider immediately!"
        }
        
        return responses.get(status, f"Glucose reading logged: {reading} mg/dL")
    
    def get_recommendations(self, reading: int, status: str) -> List[str]:
        """Get recommendations based on glucose reading"""
        recommendations = []
        
        if status == 'critically_low':
            recommendations = [
                "Consume 15g of fast-acting carbs (glucose tablets, juice)",
                "Recheck in 15 minutes",
                "Contact healthcare provider immediately"
            ]
        elif status == 'low':
            recommendations = [
                "Have a small snack with 15-20g carbs",
                "Avoid intense exercise for now",
                "Monitor closely"
            ]
        elif status == 'normal':
            recommendations = [
                "Keep up the good work!",
                "Maintain your current meal plan",
                "Continue regular monitoring"
            ]
        elif status == 'elevated':
            recommendations = [
                "Consider a low-carb meal for next eating",
                "Stay hydrated",
                "Light physical activity may help"
            ]
        elif status in ['high', 'critically_high']:
            recommendations = [
                "Avoid high-carb foods",
                "Increase water intake",
                "Consider contacting healthcare provider"
            ]
        
        return recommendations
    
    def generate_cgm_summary(self, stats: Dict[str, Any]) -> str:
        """Generate CGM summary message"""
        if stats['total_readings'] == 0:
            return "No glucose readings recorded yet. Start monitoring to track your patterns!"
        
        avg_reading = stats['average_reading']
        time_in_range = stats['time_in_range']
        trend = stats['trend']
        alerts = stats['alerts']
        
        summary = f"📊 Your glucose summary over the last 7 days:\n\n"
        summary += f"• Average reading: {avg_reading} mg/dL\n"
        summary += f"• Time in range (70-180): {time_in_range}%\n"
        summary += f"• Trend: {trend.title()}\n"
        summary += f"• Total readings: {stats['total_readings']}\n"
        summary += f"• Alerts: {alerts}\n\n"
        
        if time_in_range >= 80:
            summary += "🌟 Excellent glucose control! Keep it up!"
        elif time_in_range >= 70:
            summary += "👍 Good glucose management. Small improvements can make a big difference."
        else:
            summary += "💙 Your glucose control could benefit from some adjustments. Consider meal planning strategies."
        
        return summary

# Agent schema for Agno
AGENT_SCHEMA = {
    "name": "cgm_agent",
    "version": "1.0.0",
    "description": "Logs CGM readings and validates glucose ranges",
    "inputs": {
        "user_id": {
            "type": "integer",
            "description": "User ID",
            "required": True
        },
        "glucose_reading": {
            "type": "integer",
            "description": "Glucose reading in mg/dL",
            "minimum": 60,
            "maximum": 350,
            "required": False
        },
        "action": {
            "type": "string",
            "description": "Action to perform",
            "enum": ["log", "generate", "get_stats"],
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
        "glucose_reading": {
            "type": "integer",
            "description": "The glucose reading"
        },
        "status": {
            "type": "string",
            "description": "Glucose status category"
        },
        "alert_flag": {
            "type": "boolean",
            "description": "Whether this reading triggered an alert"
        },
        "recommendations": {
            "type": "array",
            "description": "Recommendations based on the reading"
        }
    }
}