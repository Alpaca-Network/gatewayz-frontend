-- Grant all permissions to service_role for local development
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Create RLS policy for service_role to bypass all restrictions
CREATE POLICY "Service role has full access" ON users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access" ON referrals  
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access" ON api_keys_new
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role has full access" ON credit_transactions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
