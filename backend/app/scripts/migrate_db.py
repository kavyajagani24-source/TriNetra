"""
Quick SQLite schema sync script to add any missing columns from SQLAlchemy ORM models.
"""
import sqlite3
from app.models import Base
from app.core.database import engine

def sync_schema():
    conn = sqlite3.connect("urbaneye.db")
    cursor = conn.cursor()

    for table_name, table in Base.metadata.tables.items():
        cursor.execute(f"PRAGMA table_info({table_name})")
        existing_cols = {row[1] for row in cursor.fetchall()}
        if not existing_cols:
            continue
        for col in table.columns:
            if col.name not in existing_cols:
                col_type = col.type.compile(engine.dialect)
                default_clause = ""
                if col.server_default is not None and hasattr(col.server_default, "arg"):
                    val = col.server_default.arg
                    if isinstance(val, str):
                        default_clause = f" DEFAULT '{val}'"
                    elif isinstance(val, (int, float)):
                        default_clause = f" DEFAULT {val}"
                elif col.default is not None and hasattr(col.default, "arg"):
                    val = col.default.arg
                    if isinstance(val, str):
                        default_clause = f" DEFAULT '{val}'"
                    elif isinstance(val, (int, float)):
                        default_clause = f" DEFAULT {val}"
                
                alter_stmt = f"ALTER TABLE {table_name} ADD COLUMN {col.name} {col_type}{default_clause}"
                print(f"Applying: {alter_stmt}")
                try:
                    cursor.execute(alter_stmt)
                except Exception as e:
                    print(f"Error applying {alter_stmt}: {e}")

    conn.commit()
    conn.close()
    print("Schema sync complete.")

if __name__ == "__main__":
    sync_schema()
