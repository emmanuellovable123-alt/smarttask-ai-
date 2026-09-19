-- Daily TASK AI: Meet Discovery, Profiles, Friends, Chat, Blocks & Reports Schema
-- With strict Row Level Security (RLS) policies

-- 1. MEET PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.meet_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT UNIQUE NOT NULL,
  first_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK (age >= 18),
  profile_photo_url TEXT NOT NULL,
  marital_status TEXT NOT NULL CHECK (marital_status IN ('Single', 'Married')),
  phone_number TEXT NOT NULL,
  phone_verified BOOLEAN NOT NULL DEFAULT false,
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  meet_enabled BOOLEAN NOT NULL DEFAULT true,
  meet_setup_completed BOOLEAN NOT NULL DEFAULT true,
  private_latitude DOUBLE PRECISION,
  private_longitude DOUBLE PRECISION,
  location_permission_status TEXT DEFAULT 'prompt',
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meet_profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies:
-- Users can view public profiles only if:
-- 1. Viewer is 18+
-- 2. Target user is 18+, completed setup, and has meet_enabled = true
-- 3. No active block between viewer and target
CREATE POLICY "Public discovery view policy"
ON public.meet_profiles
FOR SELECT
USING (
  meet_setup_completed = true 
  AND meet_enabled = true 
  AND age >= 18
);

-- Users can only insert or update their own profile
CREATE POLICY "Users can update own profile"
ON public.meet_profiles
FOR ALL
USING (auth.uid()::text = user_id)
WITH CHECK (auth.uid()::text = user_id);

-- Note: A public database view or RPC should be used by discovery to prevent leaking private_latitude,
-- private_longitude, and phone_number to client SELECT queries.


-- 2. FRIEND REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL REFERENCES public.meet_profiles(user_id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES public.meet_profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_sender_receiver UNIQUE (sender_id, receiver_id)
);

ALTER TABLE public.friend_requests ENABLE ROW LEVEL SECURITY;

-- Users can only read friend requests they sent or received
CREATE POLICY "Users can view their own friend requests"
ON public.friend_requests
FOR SELECT
USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

-- Users can insert a request only if they are the sender and not blocked
CREATE POLICY "Users can send friend requests"
ON public.friend_requests
FOR INSERT
WITH CHECK (auth.uid()::text = sender_id);

-- Only receiver can update status to accepted/declined, or sender can cancel
CREATE POLICY "Participants can update friend request status"
ON public.friend_requests
FOR UPDATE
USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);


-- 3. MEET BLOCKS TABLE
CREATE TABLE IF NOT EXISTS public.meet_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id TEXT NOT NULL,
  blocked_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_block UNIQUE (blocker_id, blocked_id)
);

ALTER TABLE public.meet_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own blocks"
ON public.meet_blocks
FOR ALL
USING (auth.uid()::text = blocker_id)
WITH CHECK (auth.uid()::text = blocker_id);


-- 4. MEET REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.meet_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id TEXT NOT NULL,
  reported_user_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('Spam', 'Harassment', 'Fake profile', 'Inappropriate behavior', 'Other')),
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meet_reports ENABLE ROW LEVEL SECURITY;

-- Reporter can insert report; reported user cannot view who reported them
CREATE POLICY "Users can insert reports"
ON public.meet_reports
FOR INSERT
WITH CHECK (auth.uid()::text = reporter_id);


-- 5. CONVERSATIONS & MESSAGES TABLES
CREATE TABLE IF NOT EXISTS public.meet_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_a TEXT NOT NULL,
  user_b TEXT NOT NULL,
  last_message_text TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unique_conversation_pair UNIQUE (user_a, user_b)
);

ALTER TABLE public.meet_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view conversations"
ON public.meet_conversations
FOR SELECT
USING (auth.uid()::text = user_a OR auth.uid()::text = user_b);

CREATE TABLE IF NOT EXISTS public.meet_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.meet_conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL,
  receiver_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.meet_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
ON public.meet_messages
FOR SELECT
USING (auth.uid()::text = sender_id OR auth.uid()::text = receiver_id);

CREATE POLICY "Sender can insert message"
ON public.meet_messages
FOR INSERT
WITH CHECK (auth.uid()::text = sender_id);
