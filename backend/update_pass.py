import os, psycopg2
from dotenv import load_dotenv
load_dotenv()

new_hash = "$2b$12$RQ1EnZ2.FJx8TR9KNhdPOeoj7PaOiem7NdPiHL8FYED5yeXy5ME8i"

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()
cur.execute(
    "UPDATE users SET password_hash = %s WHERE email IN ('admin@autoedge.com','sarah@autoedge.com','tom@autoedge.com','rita@autoedge.com')",
    (new_hash,)
)
conn.commit()
conn.close()
print("Passwords updated!")