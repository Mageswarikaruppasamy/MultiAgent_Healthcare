# agents/generate_dataset_pg.py
import random
import json
import db
from faker import Faker

fake = Faker()

CITIES = ["Chennai", "Coimbatore", "Bangalore", "Delhi", "Assam", "Mumbai", "Hyderabad", "Thoothukudi", "Kerala", "Goa"]
DIETARY_PREFERENCES = ["vegetarian", "non-vegetarian", "vegan"]
MEDICAL_CONDITIONS = [
    "Type 2 Diabetes", "Hypertension", "High Cholesterol", "Obesity",
    "Heart Disease", "Arthritis", "Anxiety", "Depression", "None"
]
PHYSICAL_LIMITATIONS = [
    "Mobility Issues", "Swallowing Difficulties", "Visual Impairment",
    "Hearing Loss", "Joint Pain", "Balance Issues", "None"
]

def generate_user_data():
    users = []
    diet_counts = {"vegetarian": 33, "non-vegetarian": 33, "vegan": 34}

    for diet, count in diet_counts.items():
        for _ in range(count):
            first_name = fake.first_name()
            last_name = fake.last_name()
            city = random.choice(CITIES)

            num_conditions = random.choices([0, 1, 2, 3], weights=[20, 50, 25, 5])[0]
            medical_conditions = ["None"] if num_conditions == 0 else random.sample(
                [c for c in MEDICAL_CONDITIONS if c != "None"], num_conditions
            )

            num_limitations = random.choices([0, 1, 2], weights=[60, 30, 10])[0]
            physical_limitations = ["None"] if num_limitations == 0 else random.sample(
                [l for l in PHYSICAL_LIMITATIONS if l != "None"], num_limitations
            )

            users.append({
                "first_name": first_name,
                "last_name": last_name,
                "city": city,
                "dietary_preference": diet,
                "medical_conditions": medical_conditions,
                "physical_limitations": physical_limitations
            })

    return users

def insert_users(conn, users):
    cursor = conn.cursor()
    for user in users:
        cursor.execute("""
            INSERT INTO users (first_name, last_name, city, dietary_preference, medical_conditions, physical_limitations)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user["first_name"], user["last_name"], user["city"],
            user["dietary_preference"], json.dumps(user["medical_conditions"]),
            json.dumps(user["physical_limitations"])
        ))
    conn.commit()

def generate_sample_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM users")
    user_ids = [row["id"] for row in cursor.fetchall()]

    moods = ["happy", "sad", "tired", "anxious", "calm", "angry"]

    for user_id in user_ids:
        for day in range(7):
            mood = random.choice(moods)
            cursor.execute("""
                INSERT INTO mood_logs (user_id, mood, timestamp)
                VALUES (%s, %s, NOW() - INTERVAL '%s days')
            """, (user_id, mood, day))

            glucose = random.randint(70, 200)
            alert_flag = glucose < 80 or glucose > 180
            rand_hour = random.randint(6, 22)
            rand_min = random.randint(0, 59)

            cursor.execute("""
                INSERT INTO cgm_readings (user_id, glucose_reading, alert_flag, timestamp)
                VALUES (%s, %s, %s, NOW() - INTERVAL '%s days' + INTERVAL '%s hours' + INTERVAL '%s minutes')
            """, (user_id, glucose, alert_flag, day, rand_hour, rand_min))

    conn.commit()

def main():
    print("Connecting to PostgreSQL...")
    conn = db.get_connection()

    print("Generating synthetic user data...")
    users = generate_user_data()

    print("Inserting users...")
    insert_users(conn, users)

    print("Generating sample mood and glucose readings...")
    generate_sample_data(conn)

    print("✅ Dataset generation completed successfully!")
    conn.close()

if __name__ == "__main__":
    main()
