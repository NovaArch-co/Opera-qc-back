import psycopg2

def copy_table(remote_conn, local_conn, table_name):
    remote_cursor = remote_conn.cursor()
    local_cursor = local_conn.cursor()
    
    # Fetch column names (you may want to add ordering if necessary)
    remote_cursor.execute(
        f"SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = %s ORDER BY ordinal_position", 
        (table_name,))
    columns = [row[0] for row in remote_cursor.fetchall()]
    columns_joined = ", ".join(columns)
    placeholders = ", ".join(["%s"] * len(columns))
    
    # Retrieve all rows from the remote table
    remote_cursor.execute(f"SELECT * FROM {table_name}")
    rows = remote_cursor.fetchall()
    
    if rows:
        insert_query = f"INSERT INTO {table_name} ({columns_joined}) VALUES ({placeholders})"
        local_cursor.executemany(insert_query, rows)
        local_conn.commit()
    
    remote_cursor.close()
    local_cursor.close()

# Define connection parameters for the remote database.
remote_conn = psycopg2.connect(
    host="5.202.171.177",  # remote host
    port=5432,
    user="postgres",
    password="postgres",
    dbname="opera_qc"
)

# Define connection parameters for the local database.
local_conn = psycopg2.connect(
    host="localhost",  # local host
    port=5432,
    user="postgres",
    password="postgres",
    dbname="opera_qc"
)

# Get the list of tables in the remote database's public schema.
remote_cursor = remote_conn.cursor()
remote_cursor.execute(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
)
tables = remote_cursor.fetchall()
remote_cursor.close()

# Copy data from each table to the local database.
for (table_name,) in tables:
    print(f"Copying table: {table_name}")
    copy_table(remote_conn, local_conn, table_name)

local_conn.close()
remote_conn.close()
