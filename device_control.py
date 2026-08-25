import sys
import pyodbc

device_id = sys.argv[1]
status = sys.argv[2]

# Update SQL Server
conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=DESKTOP-R87H1QS\\SQLEXPRESS,1433;'
    'DATABASE=iot_db;UID=sa;PWD=Medilla18@'
)
cursor = conn.cursor()
cursor.execute("INSERT INTO device_status (device_id, status) VALUES (?, ?)", (device_id, status))
conn.commit()
conn.close()
