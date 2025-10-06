#!/usr/bin/env python3
"""
Create credit_transactions table for tracking all credit additions and deductions
Run this once to create the table
"""

from src.supabase_config import get_supabase_client

# SQL to create the credit_transactions table
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS credit_transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    description TEXT,
    payment_id INTEGER REFERENCES payments(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}',
    balance_before DECIMAL(10, 2) NOT NULL,
    balance_after DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);

-- Enable Row Level Security
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to see their own transactions
CREATE POLICY users_can_view_own_transactions ON credit_transactions
    FOR SELECT
    USING (user_id = auth.uid()::integer);

-- Create policy to allow service role to do everything
CREATE POLICY service_role_all ON credit_transactions
    FOR ALL
    USING (true);
"""

def create_table():
    """Create the credit_transactions table"""
    try:
        client = get_supabase_client()

        print("Creating credit_transactions table...")
        print("-" * 80)

        # Execute the SQL - Note: Supabase client doesn't directly execute raw SQL
        # You'll need to run this SQL in the Supabase SQL editor
        print("Please run the following SQL in your Supabase SQL Editor:")
        print()
        print(CREATE_TABLE_SQL)
        print()
        print("-" * 80)

        # Verify table exists by trying to query it
        try:
            result = client.table('credit_transactions').select('*').limit(1).execute()
            print("✓ Table 'credit_transactions' already exists!")
            print(f"  Columns: {list(result.data[0].keys()) if result.data else 'No data yet'}")
        except Exception as e:
            print("✗ Table doesn't exist yet. Please run the SQL above in Supabase SQL Editor.")
            print(f"  Error: {e}")

    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    create_table()
