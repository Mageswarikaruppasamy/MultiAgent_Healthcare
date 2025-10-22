import os
import psycopg2
import psycopg2.extras
import json
from typing import Dict, Any
from agno.agent import Agent
from dotenv import load_dotenv
from functools import lru_cache
import time
import google.generativeai as genai
import re

# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables")

GENAI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
if not GENAI_API_KEY or GENAI_API_KEY in [
    "YOUR_GOOGLE_API_KEY_PLACEHOLDER",
    "YOUR_ACTUAL_GOOGLE_API_KEY_HERE",
    "your_actual_gemini_api_key_here"
]:
    GENAI_API_KEY = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    if not GENAI_API_KEY or GENAI_API_KEY in [
        "YOUR_GOOGLE_API_KEY_PLACEHOLDER",
        "YOUR_ACTUAL_GOOGLE_API_KEY_HERE",
        "your_actual_gemini_api_key_here"
    ]:
        raise Exception(
            "Valid Google API key not found in environment variables. Please set GOOGLE_API_KEY or GEMINI_API_KEY in your .env file."
        )

genai.configure(api_key=GENAI_API_KEY)


def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)


def classify_question(query: str) -> str:
    query = query.lower()
    
    # Check if it's a question (starts with question words or contains question marks)
    question_words = ["why", "how", "what", "when", "where", "which", "who", "whom", "whose"]
    is_question = any(query.startswith(word) for word in question_words) or "?" in query
    
    # Check for glucose logging requests
    glucose_keywords = ["glucose", "blood sugar", "sugar level", "cgm"]
    has_glucose_keyword = any(keyword in query for keyword in glucose_keywords)
    has_number = any(char.isdigit() for char in query)
    
    if has_glucose_keyword and has_number and not is_question:
        return "glucose_logging"
    
    # Check for mood logging requests
    mood_keywords = ["happy", "sad", "angry", "calm", "tired", "anxious", "feeling"]
    has_mood_keyword = any(keyword in query for keyword in mood_keywords)
    
    if has_mood_keyword and not is_question:
        return "mood_logging"
    
    # Check for meal planning requests
    meal_keywords = ["meal", "plan", "breakfast", "lunch", "dinner", "generate"]
    has_meal_keyword = any(keyword in query for keyword in meal_keywords)
    
    if has_meal_keyword and not is_question:
        return "meal_planning"
    
    # Check for nutrition analysis requests
    nutrition_keywords = ["nutrition", "nutrients", "calories", "protein", "carbs", "fat", "analyze"]
    question_phrases = ["what are", "how much", "tell me"]
    has_nutrition_keyword = any(keyword in query for keyword in nutrition_keywords)
    has_question_phrase = any(phrase in query for phrase in question_phrases)
    
    # More specific detection for nutrition analysis requests
    nutrition_food_phrases = [
        "nutrition values in", 
        "nutrients in", 
        "calories in", 
        "protein in", 
        "carbs in", 
        "fat in",
        "nutrition of",
        "nutrients of",
        "calories of",
        "protein of",
        "carbs of",
        "fat of"
    ]
    
    has_nutrition_food_phrase = any(phrase in query for phrase in nutrition_food_phrases)
    
    # Consider it a nutrition analysis request if:
    # 1. It has nutrition keywords and question phrases, OR
    # 2. It has specific nutrition+food phrases (even without question words), OR
    # 3. It starts with "what are" and has nutrition keywords
    if (has_nutrition_keyword and has_question_phrase) or has_nutrition_food_phrase or (query.startswith("what are") and has_nutrition_keyword):
        return "nutrition_analysis"
    
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
    try:
        start_time = time.time()
        model = genai.GenerativeModel("gemini-2.0-flash")
        prompt = (
            f"You are an intelligent assistant. Answer the following query clearly and concisely. "
            f"Do not use markdown, bold text, or special formatting. Just plain text.\n\n"
            f"Query: {query}"
        )
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.7, "max_output_tokens": 500},
        )
        elapsed_time = time.time() - start_time
        if elapsed_time > 30:
            print(f"Warning: LLM call took {elapsed_time:.2f} seconds")
        return {"answer": response.text.strip(), "source": "llm"}
    except Exception as e:
        print(f"Error in answer_query_cached: {e}")
        return {"answer": "I'm sorry, I can't process your request right now.", "source": "error"}


def calculate_health_score(user_id: int) -> Dict[str, Any]:
    conn = get_connection()
    cur = conn.cursor()

    try:
        # Mood score
        cur.execute(
            """
            SELECT mood, COUNT(*) FROM mood_logs
            WHERE user_id=%s AND timestamp >= NOW() - INTERVAL '7 days'
            GROUP BY mood
        """,
            (user_id,),
        )
        mood_data = cur.fetchall()
        total_mood_entries = sum(row["count"] for row in mood_data)
        mood_score = 5.0
        if total_mood_entries > 0:
            positive_moods = {"happy", "calm"}
            negative_moods = {"sad", "anxious", "angry"}
            positive_count = sum(row["count"] for row in mood_data if row["mood"] in positive_moods)
            positivity_ratio = positive_count / total_mood_entries
            mood_score = min(10.0, max(0.0, 10 * positivity_ratio))

        # Glucose score
        cur.execute(
            """
            SELECT glucose_reading FROM cgm_readings
            WHERE user_id=%s AND timestamp >= NOW() - INTERVAL '7 days'
        """,
            (user_id,),
        )
        glucose_data = cur.fetchall()
        glucose_score = 5.0
        if glucose_data:
            healthy_count = sum(1 for row in glucose_data if 80 <= row["glucose_reading"] <= 180)
            glucose_score = 10 * (healthy_count / len(glucose_data))

        # Nutrition score
        cur.execute(
            """
            SELECT meal_description FROM food_logs
            WHERE user_id=%s AND timestamp >= NOW() - INTERVAL '7 days'
        """,
            (user_id,),
        )
        food_data = cur.fetchall()
        nutrition_score = 5.0
        if food_data:
            all_meals_text = " ".join(row["meal_description"] for row in food_data).lower()
            words = set(all_meals_text.split())
            nutrition_score = min(10.0, len(words) / 2.0)

        overall_score = (mood_score * 0.3 + glucose_score * 0.4 + nutrition_score * 0.3)
        recommendations = []

        if mood_score < 5.0:
            recommendations.append("Improve mood: mindfulness, exercise, social interactions.")
        if glucose_score < 5.0:
            recommendations.append("Improve glucose control: balanced diet, avoid sugary foods.")
        if nutrition_score < 5.0:
            recommendations.append("Improve diet variety: add fruits, vegetables, whole foods.")

        return {
            "overall_score": round(overall_score, 1),
            "mood_score": round(mood_score, 1),
            "glucose_score": round(glucose_score, 1),
            "nutrition_score": round(nutrition_score, 1),
            "recommendations": recommendations,
            "success": True,
        }
    except Exception as e:
        print(f"Error calculating health score: {e}")
        return {
            "overall_score": 5.0,
            "mood_score": 5.0,
            "glucose_score": 5.0,
            "nutrition_score": 5.0,
            "recommendations": ["Unable to calculate detailed health score."],
            "success": False,
        }
    finally:
        cur.close()
        conn.close()


def answer_query(query: str) -> Dict[str, Any]:
    return answer_query_cached(query)


def interrupt_agent(user_id: int = None, query: str = "", current_context: dict = None) -> Dict[str, Any]:
    if not query:
        return {
            "success": False,
            "message": "Query is required",
            "question_type": None,
            "response_source": None,
            "navigation_suggestion": None,
            "continue_flow": True,
        }

    question_type = classify_question(query)

    if question_type == "glucose_logging":
        # Import CGM agent functions
        try:
            from cgm_agent import cgm_agent, run_tool as run_cgm_tool
            # Extract glucose value from query
            glucose_match = re.search(r'\b\d{2,3}\b', query)
            if glucose_match:
                glucose_value = int(glucose_match.group())
                result = run_cgm_tool(cgm_agent, "check_glucose", user_id=user_id, glucose_reading=glucose_value, action="log")
                if result.get("success"):
                    status = result.get("status", "Normal")
                    recommendations = result.get("recommendations", [])
                    rec_text = "\n".join([f"• {rec}" for rec in recommendations]) if recommendations else "Keep monitoring your glucose regularly."
                    
                    return {
                        "success": True,
                        "message": f"Your glucose reading of {glucose_value} mg/dL has been logged successfully!\nStatus: {status}\n\nRecommendations:\n{rec_text}",
                        "question_type": question_type,
                        "response_source": "cgm_agent",
                        "navigation_suggestion": None,
                        "continue_flow": True,
                    }
                else:
                    return {
                        "success": False,
                        "message": result.get("message", "Failed to log glucose reading"),
                        "question_type": question_type,
                        "response_source": "cgm_agent",
                        "navigation_suggestion": None,
                        "continue_flow": True,
                    }
            else:
                return {
                    "success": False,
                    "message": "I couldn't find a valid glucose value in your message. Please provide a number between 50-500 mg/dL.",
                    "question_type": question_type,
                    "response_source": "cgm_agent",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error logging glucose: {str(e)}",
                "question_type": question_type,
                "response_source": "error",
                "navigation_suggestion": None,
                "continue_flow": True,
            }

    elif question_type == "mood_logging":
        # Import mood tracker agent functions
        try:
            from mood_tracker_agent import mood_tracker_agent, run_tool as run_mood_tool
            # Extract mood from query
            result = run_mood_tool(mood_tracker_agent, "mood_tracker", user_id=user_id, user_input=query, action="log")
            if result.get("success"):
                return {
                    "success": True,
                    "message": f"Your mood '{result.get('logged_mood')}' has been logged successfully!",
                    "question_type": question_type,
                    "response_source": "mood_tracker",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to log mood"),
                    "question_type": question_type,
                    "response_source": "mood_tracker",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error logging mood: {str(e)}",
                "question_type": question_type,
                "response_source": "error",
                "navigation_suggestion": None,
                "continue_flow": True,
            }

    elif question_type == "meal_planning":
        # Import meal planner agent functions
        try:
            from meal_planner_agent import meal_planner_agent, run_tool as run_meal_tool
            # Extract special requirements from query
            special_requirements = query
            result = run_meal_tool(meal_planner_agent, "meal_planner", user_id=user_id, special_requirements=special_requirements, action="generate")
            if result.get("success") and result.get("meal_plan"):
                meal_plan = result.get("meal_plan")
                response_text = f"Here's your personalized meal plan:\n\n"
                response_text += f"**Breakfast:** {meal_plan.get('breakfast', {}).get('name', 'N/A')}\n"
                response_text += f"- {meal_plan.get('breakfast', {}).get('description', 'N/A')}\n\n"
                response_text += f"**Lunch:** {meal_plan.get('lunch', {}).get('name', 'N/A')}\n"
                response_text += f"- {meal_plan.get('lunch', {}).get('description', 'N/A')}\n\n"
                response_text += f"**Dinner:** {meal_plan.get('dinner', {}).get('name', 'N/A')}\n"
                response_text += f"- {meal_plan.get('dinner', {}).get('description', 'N/A')}\n\n"
                response_text += "Enjoy your meals!"
                
                return {
                    "success": True,
                    "message": response_text,
                    "question_type": question_type,
                    "response_source": "meal_planner",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to generate meal plan"),
                    "question_type": question_type,
                    "response_source": "meal_planner",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error generating meal plan: {str(e)}",
                "question_type": question_type,
                "response_source": "error",
                "navigation_suggestion": None,
                "continue_flow": True,
            }

    elif question_type == "nutrition_analysis":
        # Import food intake agent functions
        try:
            from food_intake_agent import food_intake_agent, run_tool as run_food_tool
            # Extract meal description from query
            meal_description = query
            
            # Extract the food item from the request
            # Look for patterns like "nutrition values in [food]" or "nutrients in [food]"
            nutrition_food_phrases = [
                "nutrition values in", 
                "nutrients in", 
                "calories in", 
                "protein in", 
                "carbs in", 
                "fat in",
                "nutrition of",
                "nutrients of",
                "calories of",
                "protein of",
                "carbs of",
                "fat of"
            ]
            
            for phrase in nutrition_food_phrases:
                if phrase in query.lower():
                    parts = query.split(phrase)
                    if len(parts) > 1:
                        meal_description = parts[1].strip()
                        break
            
            result = run_food_tool(food_intake_agent, "food_intake", user_id=user_id, meal_description=meal_description, action="log")
            if result.get("success") and result.get("nutrition_analysis"):
                nutrition = result.get("nutrition_analysis")
                response_text = f"Nutrition analysis for \"{meal_description}\":\n\n"
                response_text += f"Calories: {nutrition.get('calories', 0)} kcal\n"
                response_text += f"Protein: {nutrition.get('protein', 0)} g\n"
                response_text += f"Carbohydrates: {nutrition.get('carbohydrates', 0)} g\n"
                response_text += f"Fat: {nutrition.get('fat', 0)} g\n\n"
                response_text += "I've also logged this meal for you!"
                
                return {
                    "success": True,
                    "message": response_text,
                    "question_type": question_type,
                    "response_source": "food_intake",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
            else:
                return {
                    "success": False,
                    "message": result.get("message", "Failed to analyze nutrition"),
                    "question_type": question_type,
                    "response_source": "food_intake",
                    "navigation_suggestion": None,
                    "continue_flow": True,
                }
        except Exception as e:
            return {
                "success": False,
                "message": f"Error analyzing nutrition: {str(e)}",
                "question_type": question_type,
                "response_source": "error",
                "navigation_suggestion": None,
                "continue_flow": True,
            }

    elif question_type == "health_score":
        if user_id is None:
            answer_data = {
                "answer": "I need your user ID to calculate your health score.",
                "source": "system",
            }
        else:
            health_data = calculate_health_score(user_id)
            if health_data["success"]:
                score_breakdown = (
                    f"📊 Health Score Report\n\n"
                    f"Overall Health Score: {health_data['overall_score']}/10\n"
                    f"Mood: {health_data['mood_score']}/10\n"
                    f"Glucose: {health_data['glucose_score']}/10\n"
                    f"Nutrition: {health_data['nutrition_score']}/10\n\n"
                )
                recommendations = "\n".join([f"• {rec}" for rec in health_data["recommendations"]])
                answer_data = {
                    "answer": f"{score_breakdown}🎯 Recommendations:\n{recommendations}",
                    "source": "health_score_calculation",
                }
            else:
                answer_data = {
                    "answer": "Unable to calculate health score at the moment.",
                    "source": "system",
                }
    else:
        answer_data = answer_query(query)

    return {
        "success": True,
        "message": answer_data.get("answer"),
        "question_type": question_type,
        "response_source": answer_data.get("source"),
        "navigation_suggestion": "You can continue with your previous task or ask another question.",
        "continue_flow": True,
    }


# Setup agent
db = {"get_connection": get_connection}
interrupt_agent_instance = Agent(db=db, tools=[])

interrupt_agent_instance.tools.append({
    "name": "interrupt_agent",
    "description": "Handles Q&A, interrupts, and health score calculation",
    "func": interrupt_agent
})


def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


if __name__ == "__main__":
    print("Interrupt Agent ready. Ask your query.")
    while True:
        user_query = input("Enter query (or 'exit' to quit): ").strip()
        if user_query.lower == "exit":
            break
        print(run_tool(interrupt_agent_instance, "interrupt_agent", user_id=1, query=user_query))