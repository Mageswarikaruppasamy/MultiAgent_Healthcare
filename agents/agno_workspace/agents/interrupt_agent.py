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

    if question_type == "health_score":
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
