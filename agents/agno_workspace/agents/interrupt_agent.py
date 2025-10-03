import os
from dotenv import load_dotenv
# Use the google.generativeai library instead
import google.generativeai as genai
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from typing import Dict, Any
from functools import lru_cache
import time

# Load environment variables with explicit path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

# Try both possible environment variable names
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

# Additional check for placeholder values
if not GENAI_API_KEY or GENAI_API_KEY in ['YOUR_GOOGLE_API_KEY_PLACEHOLDER', 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE', 'your_actual_gemini_api_key_here']:
    # Try to get from environment directly as fallback
    GENAI_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not GENAI_API_KEY or GENAI_API_KEY in ['YOUR_GOOGLE_API_KEY_PLACEHOLDER', 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE', 'your_actual_gemini_api_key_here']:
        raise Exception("Valid Google API key not found in environment variables. Please set GOOGLE_API_KEY or GEMINI_API_KEY in your .env file.")

# Configure the API key
genai.configure(api_key=GENAI_API_KEY)

# DB path (if FAQs or help content stored locally)
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")


def classify_question(query: str) -> str:
    """Basic classification — could be extended with ML or rules"""
    query = query.lower()
    
    # Check for health score queries
    health_score_keywords = ["health score", "how healthy", "health rating", "wellness score"]
    if any(keyword in query for keyword in health_score_keywords):
        return "health_score"
    
    if "how" in query or "what" in query or "why" in query:
        return "informational"
    elif "help" in query:
        return "app_help"
    else:
        return "general"


@lru_cache(maxsize=128)
def answer_query_cached(query: str) -> Dict[str, Any]:
    """Use Gemini API to answer a general question with caching"""
    try:
        # Add a timeout to prevent hanging
        start_time = time.time()
        
        # Create the model - use a working model
        model = genai.GenerativeModel('gemini-2.0-flash')
        
        prompt = (
            f"You are an intelligent assistant. Answer the following query clearly and concisely. "
            f"Do not use markdown, bold text, or special formatting. Just plain text.\n\n"
            f"Query: {query}"
        )

        # Make API call with reasonable timeout
        response = model.generate_content(
            prompt,
            generation_config={
                "temperature": 0.7,
                "max_output_tokens": 500
            }
        )

        answer = response.text.strip()
        
        # Check if the operation took too long
        elapsed_time = time.time() - start_time
        if elapsed_time > 30:  # 30 seconds
            print(f"Warning: LLM call took {elapsed_time:.2f} seconds")

        return {"answer": answer, "source": "llm"}

    except Exception as e:
        print(f"Error in answer_query_cached: {e}")
        return {"answer": "I'm sorry, I'm having trouble processing your request right now. Please try again later.", "source": "error"}


def calculate_health_score(user_id: int) -> Dict[str, Any]:
    """Calculate health score based on mood, glucose, and food data"""
    import sqlite3
    
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    
    try:
        # Calculate mood score (7 days)
        cur.execute("""
            SELECT mood, COUNT(*) FROM mood_logs 
            WHERE user_id=? AND timestamp >= date('now', '-7 days')
            GROUP BY mood
        """, (user_id,))
        mood_data = cur.fetchall()
        
        total_mood_entries = sum(count for _, count in mood_data)
        mood_score = 5.0  # Default score
        
        if total_mood_entries > 0:
            # Positive moods: happy, calm
            # Neutral moods: tired
            # Negative moods: sad, anxious, angry
            positive_moods = {'happy', 'calm'}
            negative_moods = {'sad', 'anxious', 'angry'}
            
            positive_count = sum(count for mood, count in mood_data if mood in positive_moods)
            negative_count = sum(count for mood, count in mood_data if mood in negative_moods)
            
            # Mood score based on positivity ratio (0-10 scale)
            positivity_ratio = positive_count / total_mood_entries
            mood_score = min(10.0, max(0.0, 10 * positivity_ratio))
        
        # Calculate glucose score (7 days)
        cur.execute("""
            SELECT glucose_reading FROM cgm_readings 
            WHERE user_id=? AND timestamp >= date('now', '-7 days')
        """, (user_id,))
        glucose_data = cur.fetchall()
        
        glucose_score = 5.0  # Default score
        
        if glucose_data:
            # Count readings in healthy range (80-180 mg/dL)
            healthy_count = sum(1 for (reading,) in glucose_data if 80 <= reading <= 180)
            total_count = len(glucose_data)
            
            # Glucose score based on percentage in healthy range (0-10 scale)
            healthy_percentage = healthy_count / total_count if total_count > 0 else 0
            glucose_score = 10 * healthy_percentage
        
        # Calculate nutrition score (7 days)
        cur.execute("""
            SELECT meal_description FROM food_logs 
            WHERE user_id=? AND timestamp >= date('now', '-7 days')
        """, (user_id,))
        food_data = cur.fetchall()
        
        nutrition_score = 5.0  # Default score
        
        if food_data:
            # For simplicity, we'll measure variety by counting unique words in meal descriptions
            # In a real implementation, this would be more sophisticated
            all_meals_text = ' '.join(description for (description,) in food_data).lower()
            words = set(all_meals_text.split())
            
            # More variety = higher score, capped at 10
            variety_score = min(10.0, len(words) / 2.0)
            nutrition_score = max(0.0, variety_score)
        
        # Calculate overall health score (weighted average)
        overall_score = (mood_score * 0.3 + glucose_score * 0.4 + nutrition_score * 0.3)
        
        # Generate detailed recommendations based on scores
        recommendations = []
        
        # Mood recommendations
        if mood_score < 5.0:
            recommendations.extend([
                "Your mood score is low. Consider practicing mindfulness or meditation.",
                "Try to engage in activities that bring you joy.",
                "Consider speaking with a mental health professional if negative feelings persist."
            ])
        elif mood_score < 7.0:
            recommendations.extend([
                "You could improve your mood by engaging in more positive activities.",
                "Consider regular exercise, which can boost mood naturally.",
                "Maintain social connections with friends and family."
            ])
        else:
            recommendations.append("Great job maintaining a positive mood!")
        
        # Glucose recommendations
        if glucose_score < 5.0:
            recommendations.extend([
                "Your glucose levels need attention. Focus on a balanced diet.",
                "Avoid sugary snacks and drinks.",
                "Consider consulting with a nutritionist for personalized advice."
            ])
        elif glucose_score < 7.0:
            recommendations.extend([
                "Work on maintaining more consistent glucose levels.",
                "Eat regular meals and avoid skipping breakfast.",
                "Include fiber-rich foods to help stabilize blood sugar."
            ])
        else:
            recommendations.append("Excellent work maintaining stable glucose levels!")
        
        # Nutrition recommendations
        if nutrition_score < 5.0:
            recommendations.extend([
                "Your diet variety needs improvement. Try incorporating more different foods.",
                "Add more fruits and vegetables to your meals.",
                "Consider meal planning to ensure balanced nutrition."
            ])
        elif nutrition_score < 7.0:
            recommendations.extend([
                "You can enhance your diet by trying new foods.",
                "Include foods from all food groups in your meals.",
                "Stay hydrated and limit processed foods."
            ])
        else:
            recommendations.append("Your diet variety is excellent!")
        
        return {
            "overall_score": round(overall_score, 1),
            "mood_score": round(mood_score, 1),
            "glucose_score": round(glucose_score, 1),
            "nutrition_score": round(nutrition_score, 1),
            "recommendations": recommendations,
            "success": True
        }
    
    except Exception as e:
        print(f"Error calculating health score: {e}")
        return {
            "overall_score": 5.0,
            "mood_score": 5.0,
            "glucose_score": 5.0,
            "nutrition_score": 5.0,
            "recommendations": ["Unable to calculate detailed health score at the moment"],
            "success": False
        }
    finally:
        conn.close()


def answer_query(query: str) -> Dict[str, Any]:
    """Use Gemini API to answer a general question"""
    # Use cached version for better performance
    return answer_query_cached(query)


def interrupt_agent(user_id: int = None, query: str = "", current_context: dict = None) -> Dict[str, Any]:
    if not query:
        return {
            "success": False,
            "message": "Query is required",
            "question_type": None,
            "response_source": None,
            "navigation_suggestion": None,
            "continue_flow": True
        }

    question_type = classify_question(query)
    
    # Handle health score requests specially
    if question_type == "health_score":
        if user_id is None:
            answer_data = {
                "answer": "I need to know your user ID to calculate your health score. Please log in or provide your user ID.",
                "source": "system"
            }
        else:
            # Calculate health score
            health_data = calculate_health_score(user_id)
            
            if health_data["success"]:
                # Format the response with better alignment and clearer structure
                score_breakdown = (
                    f"📊 Health Score Report\n\n"
                    f"Overall Health Score: {health_data['overall_score']}/10\n\n"
                    f"Detailed Scores:\n"
                    f"  Mood: {health_data['mood_score']}/10\n"
                    f"  Glucose: {health_data['glucose_score']}/10\n"
                    f"  Nutrition: {health_data['nutrition_score']}/10\n\n"
                )
                
                # Add health insights based on overall score
                overall_score = health_data['overall_score']
                if overall_score >= 8.5:
                    health_insight = "\n🌟 Excellent! You're in great health. Keep up the good work!\n\n"
                elif overall_score >= 7.0:
                    health_insight = "\n👍 Good job! You're maintaining a healthy lifestyle with room for minor improvements.\n\n"
                elif overall_score >= 5.0:
                    health_insight = "\n⚠️ Fair health. Focus on the recommendations to improve your well-being.\n\n"
                else:
                    health_insight = "\n⚠️ Poor health. It's important to take action on the recommendations and consider consulting a healthcare professional.\n\n"
                
                # Format recommendations with each on a new line
                recommendations_str = "🎯 Personalized Recommendations:\n" + "\n".join([f"  • {rec}" for rec in health_data["recommendations"]]) if health_data["recommendations"] else ""
                
                answer_data = {
                    "answer": f"{score_breakdown}{health_insight}{recommendations_str}\n",
                    "source": "health_score_calculation"
                }
            else:
                answer_data = {
                    "answer": "Sorry, I couldn't calculate your health score at the moment. Please try again later.",
                    "source": "system"
                }
    else:
        # Handle other query types as before
        answer_data = answer_query(query)

    # Navigation suggestion can be improved with NLP context awareness
    navigation_suggestion = "You can continue with your previous task or ask another question."

    return {
        "success": True,
        "message": answer_data.get("answer"),
        "question_type": question_type,
        "response_source": answer_data.get("source"),
        "navigation_suggestion": navigation_suggestion,
        "continue_flow": True
    }


# Setup agent
db = SqliteDb(db_file=DB_PATH)
interrupt_agent_instance = Agent(db=db, tools=[])

interrupt_agent_instance.tools.append({
    "name": "interrupt_agent",
    "description": "Handles general Q&A, interrupts during any flow, and calculates health scores",
    "func": interrupt_agent
})


def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


# Greeting interaction
if __name__ == "__main__":
    print("Hello! I'm your Interrupt Agent. How can I help you today?")
    while True:
        user_query = input("Enter your question (or 'exit' to quit): ").strip()
        if user_query.lower() == "exit":
            break

        response = run_tool(interrupt_agent_instance, "interrupt_agent", query=user_query)
        print(f"Agent: {response['message']}")
        print(f"Suggestion: {response['navigation_suggestion']}")