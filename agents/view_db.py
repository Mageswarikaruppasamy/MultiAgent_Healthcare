import db

conn = db.get_connection()
cursor = conn.cursor()
cursor.execute("SELECT * FROM mood_logs LIMIT 10;")
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()
