import sqlite3
import json
import os
from typing import Dict, Any
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
from google import genai
from dotenv import load_dotenv

# DB path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")

# Load API key from environment with explicit path
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)
GENAI_API_KEY =  os.getenv("GOOGLE_API_KEY")


if not GENAI_API_KEY:
    raise Exception("GEMINI_API_KEY or GOOGLE_API_KEY not found in .env")

# Additional check for placeholder values
if GENAI_API_KEY == 'YOUR_GOOGLE_API_KEY_PLACEHOLDER' or GENAI_API_KEY == 'YOUR_ACTUAL_GOOGLE_API_KEY_HERE':
    raise Exception("Invalid API key: Placeholder value detected. Please update with a valid Google API key.")

client = genai.Client(api_key=GENAI_API_KEY)


def classify_mood_llm(user_input: str) -> str:
    """
    Uses Google Gemini (LLM) to classify mood from free text input.
    """
    try:
        prompt = (
            "You are a mood classification assistant. Classify the following input "
            "into one of these moods: happy, sad, tired, anxious, calm, energetic, angry. "
            "Only return the mood word.\n\n"
            f"User input: {user_input}"
        )

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[prompt]
        )

        mood = response.text.strip().lower()

        valid_moods = ["happy", "sad", "tired", "anxious", "calm", "energetic", "angry"]
        if mood in valid_moods:
            return mood
        return "calm"  # fallback

    except Exception as e:
        print("LLM mood classification error:", e)
        return "calm"


def mood_tracker_agent(user_id: int, mood: str = None, action: str = "log", user_input: str = None) -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        if action == "log":
            if not mood:
                if user_input:
                    mood = classify_mood_llm(user_input)
                else:
                    return {
                        "success": False,
                        "message": "Mood or user input is required to log mood",
                        "logged_mood": None,
                        "mood_stats": None,
                        "mood_history": None
                    }

            cur.execute("""
                INSERT INTO mood_logs (user_id, mood)
                VALUES (?, ?)
            """, (user_id, mood))
            conn.commit()

            return {
                "success": True,
                "message": "Mood logged successfully",
                "logged_mood": mood,
                "mood_stats": None,
                "mood_history": None
            }

        elif action == "get_stats":
            cur.execute("""
                SELECT mood, COUNT(*) FROM mood_logs WHERE user_id=?
                GROUP BY mood
            """, (user_id,))
            mood_counts = cur.fetchall()

            cur.execute("""
                SELECT mood, timestamp FROM mood_logs
                WHERE user_id=?
                ORDER BY timestamp DESC
                LIMIT 10
            """, (user_id,))
            history = cur.fetchall()

            return {
                "success": True,
                "message": "Mood statistics retrieved",
                "logged_mood": None,
                "mood_stats": {m: c for m, c in mood_counts},
                "mood_history": [{"mood": m, "timestamp": t} for m, t in history]
            }

        return {
            "success": False,
            "message": "Invalid action",
            "logged_mood": None,
            "mood_stats": None,
            "mood_history": None
        }

    except Exception as e:
        return {
            "success": False,
            "message": str(e),
            "logged_mood": None,
            "mood_stats": None,
            "mood_history": None
        }
    finally:
        conn.close()


# Agent Schema
AGENT_SCHEMA = {
    "name": "mood_tracker_agent",
    "version": "1.0.0",
    "description": "Tracks user mood and computes rolling averages",
    "inputs": {
        "user_id": {"type": "integer", "description": "User ID", "required": True},
        "mood": {
            "type": "string",
            "description": "User's current mood",
            "enum": ["happy", "sad", "tired", "anxious", "calm", "energetic", "angry"],
            "required": False
        },
        "user_input": {
            "type": "string",
            "description": "Free text describing the mood",
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
        "success": {"type": "boolean", "description": "Whether the operation was successful"},
        "message": {"type": "string", "description": "Response message"},
        "logged_mood": {"type": "string", "description": "The mood that was logged"},
        "mood_stats": {"type": "object", "description": "Mood statistics and trends"},
        "mood_history": {"type": "array", "description": "Recent mood history"}
    }
}

# Register Agent
db = SqliteDb(db_file=DB_PATH)
mood_agent = Agent(db=db, tools=[])

mood_agent.tools.append({
    "name": "mood_tracker",
    "description": "Logs moods and provides statistics",
    "func": mood_tracker_agent
})


# Helper to run tool
def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}


if __name__ == "__main__":
    print(run_tool(mood_agent, "mood_tracker", user_id=1, user_input="I feel joy", action="log"))
    
