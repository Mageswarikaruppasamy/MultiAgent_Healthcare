# data/generate_dataset.py
import sqlite3
import random
from faker import Faker
import json

fake = Faker()

# Configuration
CITIES = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego", "Dallas", "San Jose"]
DIETARY_PREFERENCES = ["vegetarian", "non-vegetarian", "vegan"]
MEDICAL_CONDITIONS = [
    "Type 2 Diabetes", "Hypertension", "High Cholesterol", "Obesity", 
    "Heart Disease", "Arthritis", "Anxiety", "Depression", "None"
]
PHYSICAL_LIMITATIONS = [
    "Mobility Issues", "Swallowing Difficulties", "Visual Impairment", 
    "Hearing Loss", "Joint Pain", "Balance Issues", "None"
]

def create_database():
    """Create SQLite database and tables"""
    conn = sqlite3.connect('healthcare_data.db')
    cursor = conn.cursor()
    
    # Create users table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            city TEXT NOT NULL,
            dietary_preference TEXT NOT NULL,
            medical_conditions TEXT NOT NULL,
            physical_limitations TEXT NOT NULL,
            baseline_glucose_min INTEGER DEFAULT 80,
            baseline_glucose_max INTEGER DEFAULT 120,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Create mood_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS mood_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            mood TEXT NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create cgm_readings table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cgm_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            glucose_reading INTEGER NOT NULL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            alert_flag BOOLEAN DEFAULT FALSE,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create food_logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS food_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            meal_description TEXT NOT NULL,
            estimated_calories REAL,
            estimated_carbs REAL,
            estimated_protein REAL,
            estimated_fat REAL,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Create meal_plans table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meal_plans (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            plan_data TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    conn.commit()
    return conn
def generate_user_data():
    """Generate synthetic user data with fixed distribution"""
    users = []
    
    # Desired distribution
    diet_counts = {
        "vegetarian": 33,
        "non-vegetarian": 33,
        "vegan": 34
    }
    
    for diet, count in diet_counts.items():
        for _ in range(count):
            # Basic info
            first_name = fake.first_name()
            last_name = fake.last_name()
            city = random.choice(CITIES)
            
            # Medical conditions (can have multiple)
            num_conditions = random.choices([0, 1, 2, 3], weights=[20, 50, 25, 5])[0]
            if num_conditions == 0:
                medical_conditions = ["None"]
            else:
                medical_conditions = random.sample(
                    [c for c in MEDICAL_CONDITIONS if c != "None"], 
                    num_conditions
                )
            
            # Physical limitations
            num_limitations = random.choices([0, 1, 2], weights=[60, 30, 10])[0]
            if num_limitations == 0:
                physical_limitations = ["None"]
            else:
                physical_limitations = random.sample(
                    [l for l in PHYSICAL_LIMITATIONS if l != "None"],
                    num_limitations
                )
            
            # Adjust glucose ranges based on medical conditions
            baseline_min, baseline_max = 80, 120
            if "Type 2 Diabetes" in medical_conditions:
                baseline_min, baseline_max = 100, 180
            elif "Hypertension" in medical_conditions:
                baseline_min, baseline_max = 85, 135
            
            users.append({
                'first_name': first_name,
                'last_name': last_name,
                'city': city,
                'dietary_preference': diet,
                'medical_conditions': json.dumps(medical_conditions),
                'physical_limitations': json.dumps(physical_limitations),
                'baseline_glucose_min': baseline_min,
                'baseline_glucose_max': baseline_max
            })
    
    return users

def insert_users(conn, users):
    """Insert users into database"""
    cursor = conn.cursor()
    
    for user in users:
        cursor.execute('''
            INSERT INTO users (first_name, last_name, city, dietary_preference, 
                             medical_conditions, physical_limitations, 
                             baseline_glucose_min, baseline_glucose_max)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            user['first_name'], user['last_name'], user['city'],
            user['dietary_preference'], user['medical_conditions'],
            user['physical_limitations'], user['baseline_glucose_min'],
            user['baseline_glucose_max']
        ))
    
    conn.commit()

def generate_sample_data(conn):
    """Generate sample mood and CGM data for testing"""
    cursor = conn.cursor()
    
    # Get all user IDs
    cursor.execute('SELECT id FROM users')
    user_ids = [row[0] for row in cursor.fetchall()]
    
    moods = ["happy", "sad", "tired", "anxious", "calm", "angry"]
    
    # Generate sample mood logs (last 7 days)
    for user_id in user_ids[:10]:  # Only for first 10 users
        for day in range(7):
            mood = random.choice(moods)
            cursor.execute('''
                INSERT INTO mood_logs (user_id, mood, timestamp)
                VALUES (?, ?, datetime('now', '-{} days'))
            '''.format(day), (user_id, mood))
    
    # Generate sample CGM readings
    for user_id in user_ids[:10]:
        # Get user's baseline glucose range
        cursor.execute('SELECT baseline_glucose_min, baseline_glucose_max FROM users WHERE id = ?', (user_id,))
        min_glucose, max_glucose = cursor.fetchone()
        
        # Generate readings for last 7 days (3 readings per day)
        for day in range(7):
            for reading in range(3):
                # Add some variation around baseline
                glucose = random.randint(
                    max(80, min_glucose - 20),
                    min(300, max_glucose + 40)
                )
                alert_flag = glucose < 80 or glucose > 300
                
                rand_hour = random.randint(0, 23)
                rand_min = random.randint(0, 59)

                cursor.execute('''
                    INSERT INTO cgm_readings (user_id, glucose_reading, alert_flag, timestamp)
                    VALUES (?, ?, ?, datetime('now', '-{} days', 'start of day', '+{} hours', '+{} minutes'))
                '''.format(day, rand_hour, rand_min), (user_id, glucose, alert_flag))

    conn.commit()


def reset_database(conn):
    """Drop all tables to reset IDs"""
    cursor = conn.cursor()
    cursor.execute("DROP TABLE IF EXISTS users")
    cursor.execute("DROP TABLE IF EXISTS mood_logs")
    cursor.execute("DROP TABLE IF EXISTS cgm_readings")
    cursor.execute("DROP TABLE IF EXISTS food_logs")
    cursor.execute("DROP TABLE IF EXISTS meal_plans")
    conn.commit()

def main():
    print("Creating database and tables...")
    conn = sqlite3.connect('healthcare_data.db')

    # 🔥 Reset DB (drop all tables)
    print("Resetting database...")
    reset_database(conn)

    # Recreate tables
    create_database()

    print("Generating synthetic user data...")
    users = generate_user_data()
    
    print("Inserting users into database...")
    insert_users(conn, users)
    
    print("Generating sample data...")
    generate_sample_data(conn)
    
    # Verify
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM users')
    user_count = cursor.fetchone()[0]
    
    cursor.execute('SELECT dietary_preference, COUNT(*) FROM users GROUP BY dietary_preference')
    diet_distribution = cursor.fetchall()
    
    cursor.execute('SELECT COUNT(DISTINCT city) FROM users')
    city_count = cursor.fetchone()[0]
    
    print(f"\n✅ Dataset generated successfully!")
    print(f"📊 Total users: {user_count}")
    print(f"🏙️  Cities: {city_count}")
    print("🥗 Dietary distribution:")
    for diet, count in diet_distribution:
        print(f"   {diet}: {count} users")
    
    conn.close()

if __name__ == "__main__":
    main()