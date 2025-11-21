-- Ensure PostgREST picks up new tables (like stripe_webhook_events) without manual intervention
-- by notifying it whenever DDL finishes, and trigger an immediate reload for the new table.

-- Function used by the event trigger to notify PostgREST
CREATE OR REPLACE FUNCTION notify_postgrest_schema_reload()
RETURNS event_trigger
LANGUAGE plpgsql
AS $$
BEGIN
    PERFORM pg_notify('pgrst', 'reload schema');
END;
$$;

-- Event trigger that fires after any DDL command to refresh the PostgREST schema cache
DROP EVENT TRIGGER IF EXISTS postgrest_schema_reload;
CREATE EVENT TRIGGER postgrest_schema_reload
    ON ddl_command_end
    EXECUTE PROCEDURE notify_postgrest_schema_reload();

-- Immediately refresh the schema cache so the new stripe_webhook_events table is available
NOTIFY pgrst, 'reload schema';
