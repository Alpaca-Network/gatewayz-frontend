-- Create rate_limit_configs table
-- Stores per-API-key rate limit configurations
CREATE TABLE IF NOT EXISTS "public"."rate_limit_configs" (
    "id" bigint NOT NULL DEFAULT nextval('rate_limit_configs_id_seq'::regclass),
    "api_key_id" bigint NOT NULL,
    "window_type" text DEFAULT 'sliding'::text,
    "window_size" integer DEFAULT 3600,
    "max_requests" integer DEFAULT 1000,
    "max_tokens" integer DEFAULT 1000000,
    "burst_limit" integer DEFAULT 100,
    "concurrency_limit" integer DEFAULT 10,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT "rate_limit_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_limit_configs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys_new"("id") ON DELETE CASCADE
);

-- Create index on api_key_id for faster lookups
CREATE INDEX IF NOT EXISTS "rate_limit_configs_api_key_id_idx" ON "public"."rate_limit_configs" USING btree ("api_key_id");

-- Create rate_limit_usage table
-- Tracks rate limit window usage (minute, hour, day windows)
CREATE TABLE IF NOT EXISTS "public"."rate_limit_usage" (
    "id" bigint NOT NULL DEFAULT nextval('rate_limit_usage_id_seq'::regclass),
    "user_id" bigint NOT NULL,
    "api_key" text NOT NULL,
    "window_type" text NOT NULL,
    "window_start" timestamp with time zone NOT NULL,
    "requests_count" integer DEFAULT 0,
    "tokens_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    "updated_at" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT "rate_limit_usage_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "rate_limit_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "rate_limit_usage_unique" UNIQUE ("api_key", "window_type", "window_start")
);

-- Create indexes on rate_limit_usage for performance
CREATE INDEX IF NOT EXISTS "rate_limit_usage_api_key_idx" ON "public"."rate_limit_usage" USING btree ("api_key");
CREATE INDEX IF NOT EXISTS "rate_limit_usage_user_id_idx" ON "public"."rate_limit_usage" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "rate_limit_usage_window_start_idx" ON "public"."rate_limit_usage" USING btree ("window_start");
CREATE INDEX IF NOT EXISTS "rate_limit_usage_window_type_idx" ON "public"."rate_limit_usage" USING btree ("window_type");

-- Create api_key_audit_logs table
-- Stores audit trail of API key operations
CREATE TABLE IF NOT EXISTS "public"."api_key_audit_logs" (
    "id" bigint NOT NULL DEFAULT nextval('api_key_audit_logs_id_seq'::regclass),
    "user_id" bigint NOT NULL,
    "api_key_id" bigint,
    "action" text NOT NULL,
    "details" jsonb DEFAULT '{}'::jsonb,
    "timestamp" timestamp with time zone DEFAULT (now() AT TIME ZONE 'UTC'::text),
    CONSTRAINT "api_key_audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "api_key_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "api_key_audit_logs_api_key_id_fkey" FOREIGN KEY ("api_key_id") REFERENCES "public"."api_keys_new"("id") ON DELETE SET NULL
);

-- Create indexes on api_key_audit_logs for performance
CREATE INDEX IF NOT EXISTS "api_key_audit_logs_user_id_idx" ON "public"."api_key_audit_logs" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "api_key_audit_logs_api_key_id_idx" ON "public"."api_key_audit_logs" USING btree ("api_key_id");
CREATE INDEX IF NOT EXISTS "api_key_audit_logs_action_idx" ON "public"."api_key_audit_logs" USING btree ("action");
CREATE INDEX IF NOT EXISTS "api_key_audit_logs_timestamp_idx" ON "public"."api_key_audit_logs" USING btree ("timestamp");

-- Create sequences if they don't exist
CREATE SEQUENCE IF NOT EXISTS "public"."rate_limit_configs_id_seq" OWNED BY "public"."rate_limit_configs"."id";
CREATE SEQUENCE IF NOT EXISTS "public"."rate_limit_usage_id_seq" OWNED BY "public"."rate_limit_usage"."id";
CREATE SEQUENCE IF NOT EXISTS "public"."api_key_audit_logs_id_seq" OWNED BY "public"."api_key_audit_logs"."id";

-- Enable Row Level Security (RLS)
ALTER TABLE "public"."rate_limit_configs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."rate_limit_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."api_key_audit_logs" ENABLE ROW LEVEL SECURITY;

-- Set up RLS policies for rate_limit_configs
CREATE POLICY "Users can read their own rate limit configs" ON "public"."rate_limit_configs"
    FOR SELECT USING (
        api_key_id IN (
            SELECT id FROM public.api_keys_new WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role can manage rate limit configs" ON "public"."rate_limit_configs"
    FOR ALL USING (auth.role() = 'service_role');

-- Set up RLS policies for rate_limit_usage
CREATE POLICY "Users can read their own rate limit usage" ON "public"."rate_limit_usage"
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage rate limit usage" ON "public"."rate_limit_usage"
    FOR ALL USING (auth.role() = 'service_role');

-- Set up RLS policies for api_key_audit_logs
CREATE POLICY "Users can read their own audit logs" ON "public"."api_key_audit_logs"
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Service role can manage audit logs" ON "public"."api_key_audit_logs"
    FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."rate_limit_configs" TO "authenticated";
GRANT SELECT, INSERT, UPDATE, DELETE ON "public"."rate_limit_usage" TO "authenticated";
GRANT SELECT ON "public"."api_key_audit_logs" TO "authenticated";

GRANT ALL ON "public"."rate_limit_configs" TO "service_role";
GRANT ALL ON "public"."rate_limit_usage" TO "service_role";
GRANT ALL ON "public"."api_key_audit_logs" TO "service_role";
