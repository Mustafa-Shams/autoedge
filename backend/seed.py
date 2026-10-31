import os
from dotenv import load_dotenv
load_dotenv()

import psycopg2

conn = psycopg2.connect(os.getenv("DATABASE_URL"))
cur = conn.cursor()

with open("database/seed.sql", "r") as f:
    sql = f.read()

cur.execute(sql)
conn.commit()
cur.close()
conn.close()
print("Seed complete!")