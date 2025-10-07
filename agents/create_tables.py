import db

def create_tables(conn):
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        city TEXT NOT NULL,
        dietary_preference TEXT NOT NULL,
        medical_conditions JSONB NOT NULL,
        physical_limitations JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mood_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        mood TEXT NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS cgm_readings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        glucose_reading INTEGER NOT NULL,
        alert_flag BOOLEAN DEFAULT FALSE,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS food_logs (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        meal_description TEXT NOT NULL,
        estimated_calories REAL,
        estimated_carbs REAL,
        estimated_protein REAL,
        estimated_fat REAL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS meal_plans (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        plan_data TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )""")

    conn.commit()

if __name__ == "__main__":
    conn = db.get_connection()
    create_tables(conn)
    print("✅ Tables created successfully")
