-- Add index on SessionEvent.id for faster queries
CREATE INDEX IF NOT EXISTS "SessionEvent_id_idx" ON "SessionEvent"("id");
 
-- Add index on date field for potential date-based queries
CREATE INDEX IF NOT EXISTS "SessionEvent_date_idx" ON "SessionEvent"("date"); 