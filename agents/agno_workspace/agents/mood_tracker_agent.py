import sqlite3
import json
import os
from typing import Dict, Any
from agno.agent import Agent
from agno.db.sqlite import SqliteDb
import google.generativeai as genai
from dotenv import load_dotenv
from functools import lru_cache
import time
import re

# DB path
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(CURRENT_DIR)))
DB_PATH = os.path.join(BASE_DIR, "data", "healthcare_data.db")

# Load API key
env_path = os.path.join(BASE_DIR, '.env')
load_dotenv(dotenv_path=env_path, override=True)
GENAI_API_KEY = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")

if not GENAI_API_KEY:
    raise Exception("Valid Google API key not found in environment variables.")

# Configure Gemini
genai.configure(api_key=GENAI_API_KEY)

# --------------------------
# Keyword-based mood mapping
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
    """Fast keyword-based mood classification"""
    text = user_input.lower()
    for mood, keywords in MOOD_KEYWORDS.items():
        if any(word in text for word in keywords):
            return mood
    return None

# --------------------------
# LLM fallback
# --------------------------
@lru_cache(maxsize=128)
def classify_mood_llm(user_input: str) -> str:
    """Uses Gemini only if no keyword matches"""
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
        mood_match = re.search(r'\b(happy|sad|calm|tired|anxious|angry)\b', mood_text)
        if mood_match:
            return mood_match.group(1)
        return "calm"  # default fallback
    except Exception as e:
        print("LLM classification error:", e)
        return "calm"

# --------------------------
# Mood Tracker Agent
# --------------------------
def mood_tracker_agent(user_id: int, mood: str = None, action: str = "log", user_input: str = None) -> Dict[str, Any]:
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    try:
        if action == "log":
            if not mood:
                if user_input:
                    # Step 1: Direct match
                    user_input_lower = user_input.lower().strip()
                    if user_input_lower in VALID_MOODS:
                        mood = user_input_lower
                    else:
                        # Step 2: Keyword check
                        mood = classify_mood_keywords(user_input)
                        # Step 3: LLM fallback
                        if not mood:
                            mood = classify_mood_llm(user_input)
                else:
                    return {"success": False, "message": "Mood or input required", "logged_mood": None}

            cur.execute("INSERT INTO mood_logs (user_id, mood) VALUES (?, ?)", (user_id, mood))
            conn.commit()

            return {"success": True, "message": "Mood logged successfully", "logged_mood": mood}

        elif action == "get_stats":
            cur.execute("SELECT mood, COUNT(*) FROM mood_logs WHERE user_id=? GROUP BY mood", (user_id,))
            mood_counts = dict(cur.fetchall())
            cur.execute("SELECT mood, timestamp FROM mood_logs WHERE user_id=? ORDER BY timestamp DESC LIMIT 10", (user_id,))
            history = [{"mood": m, "timestamp": t} for m, t in cur.fetchall()]

            return {"success": True, "message": "Mood statistics retrieved", "mood_stats": mood_counts, "mood_history": history}

        return {"success": False, "message": "Invalid action"}
    finally:
        conn.close()

# --------------------------
# Agent Schema & Registration
# --------------------------
AGENT_SCHEMA = {
    "name": "mood_tracker_agent",
    "version": "1.0.0",
    "description": "Tracks user mood and computes rolling averages",
    "inputs": {
        "user_id": {"type": "integer", "required": True},
        "mood": {"type": "string", "enum": VALID_MOODS, "required": False},
        "user_input": {"type": "string", "required": False},
        "action": {"type": "string", "enum": ["log", "get_stats"], "default": "log"}
    },
    "outputs": {
        "success": {"type": "boolean"},
        "message": {"type": "string"},
        "logged_mood": {"type": "string"},
        "mood_stats": {"type": "object"},
        "mood_history": {"type": "array"}
    }
}

db = SqliteDb(db_file=DB_PATH)
mood_agent = Agent(db=db, tools=[{"name": "mood_tracker", "description": "Logs moods and provides statistics", "func": mood_tracker_agent}])

# --------------------------
# Helper to run tool
# --------------------------
def run_tool(agent: Agent, tool_name: str, **kwargs):
    for tool in agent.tools:
        if tool["name"] == tool_name:
            return tool["func"](**kwargs)
    return {"success": False, "message": f"Tool {tool_name} not found"}

# --------------------------
# Example
# --------------------------
if __name__ == "__main__":
    print(run_tool(mood_agent, "mood_tracker", user_id=1, user_input="I feel mad", action="log"))
