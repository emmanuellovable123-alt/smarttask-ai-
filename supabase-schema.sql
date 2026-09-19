-- Supabase Schema for Daily TASK AI

-- ADMIN CONFIGURATION
CREATE TABLE admin_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT UNIQUE NOT NULL,
  value_json JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE admin_config ENABLE ROW LEVEL SECURITY;
-- Only allow super admins or service role to modify. Anyone can read.
CREATE POLICY "Anyone can read config" ON admin_config FOR SELECT USING (true);

-- Initial default config
INSERT INTO admin_config (key_name, value_json) VALUES
('ad_settings', '{"task_creation_ad_enabled": true, "reminder_ad_delay_ms": 15000}'),
('pricing_settings', '{"monthly_usd": 4.99, "monthly_ngn": 2500, "monthly_zar": 80}'),
('provider_status', '{"paystack": "active", "flutterwave": "active", "lemonsqueezy": "active"}');

-- PROFILES
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  country TEXT NOT NULL,
  age TEXT,
  timezone TEXT,
  subscription_status TEXT DEFAULT 'FREE' CHECK (subscription_status IN ('FREE', 'PREMIUM')),
  subscription_provider TEXT,
  subscription_id TEXT,
  subscription_expires_at TIMESTAMPTZ,
  
  -- Phase 5B: Meet Profile Foundation
  profile_photo_url TEXT,
  marital_status TEXT CHECK (marital_status IN ('Single', 'Married')),
  phone_number TEXT,
  phone_verified BOOLEAN DEFAULT FALSE,
  meet_setup_completed BOOLEAN DEFAULT FALSE,
  meet_enabled BOOLEAN DEFAULT FALSE,
  city TEXT,
  location_permission_status TEXT DEFAULT 'prompt',
  private_latitude DOUBLE PRECISION,
  private_longitude DOUBLE PRECISION,
  last_seen_at TIMESTAMPTZ,
  is_online BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- MEET PHONE VERIFICATIONS TABLE
CREATE TABLE meet_phone_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  phone_number TEXT NOT NULL,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meet_phone_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own phone verifications" ON meet_phone_verifications 
  FOR ALL USING (auth.uid() = user_id);

-- SECURE PUBLIC MEET PROFILES VIEW (Phase 5B Privacy Foundation)
-- Strictly excludes phone numbers and private coordinates!
-- Strictly excludes under-18 users and meet-disabled users!
CREATE VIEW public_meet_profiles AS
SELECT 
  p.id,
  p.name,
  p.profile_photo_url,
  p.marital_status,
  p.country,
  p.city,
  p.last_seen_at,
  p.is_online
FROM profiles p
WHERE 
  p.meet_setup_completed = TRUE 
  AND p.meet_enabled = TRUE 
  AND p.phone_verified = TRUE
  AND p.age IS NOT NULL 
  AND CAST(NULLIF(regexp_replace(p.age, '\D', '', 'g'), '') AS INTEGER) >= 18;

-- TASKS
CREATE TABLE tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  task_text TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  scheduled_time TEXT NOT NULL,
  timezone TEXT,
  status TEXT NOT NULL DEFAULT 'Pending',
  reminder_status TEXT,
  recurrence_rule TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own tasks" ON tasks FOR ALL USING (auth.uid() = user_id);

-- DAILY_REPORTS
CREATE TABLE daily_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  report_date DATE NOT NULL,
  fulfilled_count INTEGER DEFAULT 0,
  not_fulfilled_count INTEGER DEFAULT 0,
  total_count INTEGER DEFAULT 0,
  report_text TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, report_date)
);

ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own reports" ON daily_reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own reports" ON daily_reports FOR INSERT WITH CHECK (auth.uid() = user_id);

-- SUBSCRIPTIONS
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  provider TEXT NOT NULL,
  provider_customer_id TEXT,
  provider_subscription_id TEXT,
  plan_name TEXT NOT NULL,
  status TEXT NOT NULL,
  amount DECIMAL(10,2),
  currency TEXT,
  started_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscriptions" ON subscriptions FOR SELECT USING (auth.uid() = user_id);

-- PAYMENT_TRANSACTIONS
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) NOT NULL,
  provider TEXT NOT NULL,
  transaction_reference TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  payment_type TEXT,
  provider_response_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own transactions" ON payment_transactions FOR SELECT USING (auth.uid() = user_id);
