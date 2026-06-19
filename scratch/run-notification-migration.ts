import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};
envContent.split('\n').forEach(line => {
  const parts = line.split('=');
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join('=').trim();
  }
});

const supabaseUrl = env['VITE_SUPABASE_URL'];
const supabaseServiceKey = env['VITE_SUPABASE_SERVICE_ROLE_KEY'];

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const sql = `
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_id UUID REFERENCES public.users(id) ON DELETE CASCADE;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS recipient_role TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS message TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'MEDIUM';
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS read_status BOOLEAN DEFAULT false;

-- Populate existing rows to avoid null values
UPDATE public.notifications SET recipient_id = user_id WHERE recipient_id IS NULL;
UPDATE public.notifications SET message = content WHERE message IS NULL;
UPDATE public.notifications SET category = type WHERE category IS NULL;
UPDATE public.notifications SET read_status = is_read WHERE read_status IS NULL;

-- Trigger or function to sync older columns with newer columns
CREATE OR REPLACE FUNCTION sync_notifications_columns()
RETURNS TRIGGER AS $$
BEGIN
  -- Sync recipient_id and user_id
  IF NEW.recipient_id IS NOT NULL AND (NEW.user_id IS NULL OR NEW.user_id <> NEW.recipient_id) THEN
    NEW.user_id := NEW.recipient_id;
  ELSIF NEW.user_id IS NOT NULL AND (NEW.recipient_id IS NULL OR NEW.recipient_id <> NEW.user_id) THEN
    NEW.recipient_id := NEW.user_id;
  END IF;

  -- Sync message and content
  IF NEW.message IS NOT NULL AND (NEW.content IS NULL OR NEW.content <> NEW.message) THEN
    NEW.content := NEW.message;
  ELSIF NEW.content IS NOT NULL AND (NEW.message IS NULL OR NEW.message <> NEW.content) THEN
    NEW.message := NEW.content;
  END IF;

  -- Sync category and type
  IF NEW.category IS NOT NULL AND (NEW.type IS NULL OR NEW.type <> NEW.category) THEN
    NEW.type := NEW.category;
  ELSIF NEW.type IS NOT NULL AND (NEW.category IS NULL OR NEW.category <> NEW.type) THEN
    NEW.category := NEW.type;
  END IF;

  -- Sync read_status and is_read
  IF NEW.read_status IS NOT NULL AND (NEW.is_read IS NULL OR NEW.is_read <> NEW.read_status) THEN
    NEW.is_read := NEW.read_status;
  ELSIF NEW.is_read IS NOT NULL AND (NEW.read_status IS NULL OR NEW.read_status <> NEW.is_read) THEN
    NEW.read_status := NEW.is_read;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_sync_notifications ON public.notifications;
CREATE TRIGGER trigger_sync_notifications
  BEFORE INSERT OR UPDATE ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION sync_notifications_columns();
`;

async function run() {
  console.log("Executing Notifications Migration SQL...");
  const { data, error } = await supabaseAdmin.rpc('exec_sql', { sql_query: sql });
  if (error) {
    console.error("Failed to execute SQL:", error.message);
  } else {
    console.log("SQL executed successfully! Result:", data);
  }
}

run().catch(console.error);
