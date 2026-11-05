-- =============================================================================
-- StockLens Supabase Schema (Phase 5)
-- Paste this entire file into the Supabase SQL Editor and click "Run".
-- =============================================================================

-- 1. Watchlist Table
-- Stores user's pinned stocks linked to an anonymous device UUID.
create table if not exists public.watchlist (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  ticker text not null,
  created_at timestamptz not null default now(),
  constraint watchlist_device_ticker_unique unique (device_id, ticker)
);

create index if not exists idx_watchlist_device_id on public.watchlist(device_id);

-- 2. API Cache Table
-- Server-side shared cache for Finnhub quotes/candles and Gemini plain-language analyses.
-- Shared across all users to preserve API quotas and eliminate duplicate calls.
create table if not exists public.api_cache (
  key text primary key,
  value jsonb not null,
  expires_at timestamptz not null
);

create index if not exists idx_api_cache_expires_at on public.api_cache(expires_at);

-- 3. Rate Limits Table
-- Tracks global and per-device request volume and prevents Gemini quota exhaustion.
create table if not exists public.rate_limits (
  key text primary key,
  count int not null default 1,
  window_start timestamptz not null default now()
);

-- 4. Chats Table
-- Stores saved conversation threads per anonymous device (max 20 per device).
create table if not exists public.chats (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null,
  ticker text not null,
  title text not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_chats_device_updated on public.chats(device_id, updated_at desc);

-- 5. Chat Messages Table
-- Stores individual conversation bubbles, overview payloads, comparisons, and history cards.
create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  chat_id uuid not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  kind text not null default 'follow_up',
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_chat_messages_chat_id on public.chat_messages(chat_id, created_at asc);

-- =============================================================================
-- Security: Enable Row Level Security (RLS) on ALL tables with NO public policies
-- All mutations and queries are executed exclusively server-side using the
-- SUPABASE_SERVICE_ROLE_KEY, which completely bypasses RLS and is never
-- exposed to the client browser.
-- =============================================================================

alter table public.watchlist enable row level security;
alter table public.api_cache enable row level security;
alter table public.rate_limits enable row level security;
alter table public.chats enable row level security;
alter table public.chat_messages enable row level security;

-- Revoke all direct public/anon access to ensure complete lockdown
revoke all on public.watchlist from anon, authenticated;
revoke all on public.api_cache from anon, authenticated;
revoke all on public.rate_limits from anon, authenticated;
revoke all on public.chats from anon, authenticated;
revoke all on public.chat_messages from anon, authenticated;
