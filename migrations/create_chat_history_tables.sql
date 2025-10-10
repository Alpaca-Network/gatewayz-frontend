-- Create chat_sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    title VARCHAR(255) NOT NULL,
    model VARCHAR(100) NOT NULL DEFAULT 'openai/gpt-3.5-turbo',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Foreign key constraint
    CONSTRAINT fk_chat_sessions_user_id 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE
);

-- Create chat_messages table
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    session_id INTEGER NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    model VARCHAR(100),
    tokens INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Foreign key constraint
    CONSTRAINT fk_chat_messages_session_id 
        FOREIGN KEY (session_id) 
        REFERENCES chat_sessions(id) 
        ON DELETE CASCADE
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_is_active ON chat_sessions(is_active);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_role ON chat_messages(role);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_active ON chat_sessions(user_id, is_active, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created ON chat_messages(session_id, created_at);

-- Add RLS (Row Level Security) policies if needed
-- ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policy for chat_sessions (users can only access their own sessions)
-- CREATE POLICY "Users can access their own chat sessions" ON chat_sessions
--     FOR ALL USING (user_id = auth.uid());

-- Create policy for chat_messages (users can only access messages from their sessions)
-- CREATE POLICY "Users can access messages from their sessions" ON chat_messages
--     FOR ALL USING (
--         session_id IN (
--             SELECT id FROM chat_sessions WHERE user_id = auth.uid()
--         )
--     );

-- Add comments for documentation
COMMENT ON TABLE chat_sessions IS 'Stores chat sessions for users';
COMMENT ON TABLE chat_messages IS 'Stores individual messages within chat sessions';

COMMENT ON COLUMN chat_sessions.user_id IS 'Reference to the user who owns this session';
COMMENT ON COLUMN chat_sessions.title IS 'Display title for the chat session';
COMMENT ON COLUMN chat_sessions.model IS 'AI model used for this session';
COMMENT ON COLUMN chat_sessions.is_active IS 'Soft delete flag - FALSE means session is deleted';

COMMENT ON COLUMN chat_messages.session_id IS 'Reference to the chat session this message belongs to';
COMMENT ON COLUMN chat_messages.role IS 'Message role: user or assistant';
COMMENT ON COLUMN chat_messages.content IS 'The actual message content';
COMMENT ON COLUMN chat_messages.tokens IS 'Number of tokens in this message';
