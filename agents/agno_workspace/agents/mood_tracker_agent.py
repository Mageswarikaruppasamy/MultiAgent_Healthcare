import os
import psycopg2
import psycopg2.extras
import json
import re
import time
from typing import Dict, Any
from agno.agent import Agent
from dotenv import load_dotenv
from functools import lru_cache
import google.generativeai as genai

# --------------------------
# Environment & Config
# --------------------------
# Load environment variables
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if not DATABASE_URL:
    raise Exception("DATABASE_URL not found in environment variables.")
if not GENAI_API_KEY:
    raise Exception("Valid Google API key not found in environment variables.")

genai.configure(api_key=GENAI_API_KEY)

# --------------------------
# DB Connection Helper
# --------------------------
def get_connection():
    return psycopg2.connect(DATABASE_URL, cursor_factory=psycopg2.extras.RealDictCursor)

# --------------------------
# Mood Keywords
# --------------------------
MOOD_KEYWORDS = {
    "happy": ["happy", "joy", "glad", "excited", "smile", "delighted"],
    "sad": ["sad", "down", "cry", "blue", "upset", "depressed", "lonely"],
    "calm": ["calm", "peaceful", "relaxed", "chill", "okay", "fine"],
    "tired": ["tired", "sleepy", "exhausted", "fatigued", "weary"],
    "anxious": ["anxious", "nervous", "worried", "stressed", "uneasy"],
    "angry": ["angry", "mad", "furious", "annoyed", "irritated", "frustrated"],
}
VALID_MOODS = list(MOOD_KEYWORDS.keys())

def classify_mood_keywords(user_input: str) -> str:
    """Keyword-based mood classification."""
    text = user_input.lower()
    for mood, keywords in MOOD_KEYWORDS.items():
        if any(word in text for word in keywords):
            return mood
    return None

@lru_cache(maxsize=128)
def classify_mood_llm(user_input: str) -> str:
    """Uses Gemini if no keyword match."""
    try:
        model = genai.GenerativeModel('gemini-2.0-flash')
        prompt = (
            "Classify the following input into EXACTLY ONE of these moods: "
            "happy, sad, calm, tired, anxious, angry. "
            "Return ONLY the mood word.\n\n"
            f"User input: {user_input}"
        )
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.2, "max_output_tokens": 10}
        )
        mood_text = response.text.strip().lower()
        match = re.search(r'\b(happy|sad|calm|tired|anxious|angry)\b', mood_text)
        return match.group(1) if match else "calm"
    except Exception as e:
        print("LLM classification error:", e)
        return "calm"

# --------------------------
# Mood Tracker Agent
# --------------------------
def mood_tracker_agent(user_id: int, mood: str = None, action: str = "log", user_input: str = None) -> Dict[str, Any]:
    try:
        conn = get_connection()
        cur = conn.cursor()

        if action == "log":
            if not mood:
                if user_input:
                    user_input_lower = user_input.lower().strip()
                    if user_input_lower in VALID_MOODS:
                        mood = user_input_lower
                    else:
                        mood = classify_mood_keywords(user_input)
                        if not mood:
                            mood = classify_mood_llm(user_input)
                else:
                    return {"success": False, "message": "Mood or input required", "logged_mood": None}

            cur.execute("""
                CREATE TABLE IF NOT EXISTS mood_logs (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER REFERENCES users(id),
                    mood TEXT NOT NULL,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cur.execute("INSERT INTO mood_logs (user_id, mood) VALUES (%s, %s) RETURNING id", (user_id, mood))
            inserted_id = cur.fetchone()["id"]
            conn.commit()

            return {"success": True, "message": "Mood logged successfully", "logged_mood": mood, "log_id": inserted_id}

        elif action == "get_stats":
            cur.execute("SELECT mood, COUNT(*) AS count FROM mood_logs WHERE user_id=%s GROUP BY mood", (user_id,))
            mood_counts = {row["mood"]: row["count"] for row in cur.fetchall()}

            cur.execute("SELECT mood, timestamp FROM mood_logs WHERE user_id=%s ORDER BY timestamp DESC LIMIT 10", (user_id,))
            history = [{"mood": row["mood"], "timestamp": row["timestamp"]} for row in cur.fetchall()]

            return {"success": True, "message": "Mood statistics retrieved", "mood_stats": mood_counts, "mood_history": history}

        return {"success": False, "message": "Invalid action"}
    except Exception as e:
        return {"success": False, "message": f"Error in mood tracker agent: {str(e)}"}
    finally:
        cur.close()
        conn.close()

# --------------------------
# Agent Setup
# --------------------------
from agno.db.postgres import PostgresDb  # Ensure PostgresDb exists
db = PostgresDb(DATABASE_URL)

mood_agent = Agent(db=db, tools=[{
    "name": "mood_tracker",
    "description": "Logs moods and provides statistics",
    "func": mood_tracker_agent
}])

# --------------------------
# Run Helper
# --------------------------
def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}

# --------------------------
# Example Run
# --------------------------
if __name__ == "__main__":
    print(run_tool(mood_agent, "mood_tracker", user_id=1, user_input="I feel mad", action="log"))