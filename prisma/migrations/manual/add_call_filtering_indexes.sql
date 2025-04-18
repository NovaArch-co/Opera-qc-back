-- Add indexes for better query performance on SessionEvent table
CREATE INDEX IF NOT EXISTS "SessionEvent_date_idx" ON "SessionEvent"("date");
CREATE INDEX IF NOT EXISTS "SessionEvent_destNumber_idx" ON "SessionEvent"("dest_number");
CREATE INDEX IF NOT EXISTS "SessionEvent_emotion_idx" ON "SessionEvent"("emotion");
CREATE INDEX IF NOT EXISTS "SessionEvent_routinCheckStart_idx" ON "SessionEvent"("routinCheckStart");
CREATE INDEX IF NOT EXISTS "SessionEvent_routinCheckEnd_idx" ON "SessionEvent"("routinCheckEnd");
CREATE INDEX IF NOT EXISTS "SessionEvent_duration_idx" ON "SessionEvent"("duration"); 