-- ============================================================
-- 네모네모 디펜스 — 소셜 백엔드(접속상태/로비채팅/귓속말·DM/파티)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 한 번 실행하세요.
-- (이미 profiles, friendships 테이블은 만들어져 있다는 전제)
-- ============================================================

-- 1) 프로필에 마지막 접속 시각(오프라인 친구 "마지막 접속" 표시용)
alter table public.profiles add column if not exists last_seen timestamptz;

-- 2) 1:1 메시지(귓속말/DM 기록)
create table if not exists public.messages (
  id         uuid primary key default gen_random_uuid(),
  sender     uuid not null references auth.users(id) on delete cascade,
  recipient  uuid not null references auth.users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);
alter table public.messages enable row level security;
drop policy if exists "msg_read_own"   on public.messages;
drop policy if exists "msg_insert_own" on public.messages;
create policy "msg_read_own"   on public.messages for select using (auth.uid() = sender or auth.uid() = recipient);
create policy "msg_insert_own" on public.messages for insert with check (auth.uid() = sender);

-- 3) 파티
create table if not exists public.parties (
  id         uuid primary key default gen_random_uuid(),
  leader     uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.party_members (
  party_id  uuid not null references public.parties(id) on delete cascade,
  uid       uuid not null references auth.users(id) on delete cascade,
  nick      text,
  tag       text,
  joined_at timestamptz not null default now(),
  primary key (party_id, uid)
);
create table if not exists public.party_invites (
  id         uuid primary key default gen_random_uuid(),
  party_id   uuid not null references public.parties(id) on delete cascade,
  from_uid   uuid not null,
  from_nick  text,
  to_uid     uuid not null,
  status     text not null default 'pending',
  created_at timestamptz not null default now()
);

alter table public.parties        enable row level security;
alter table public.party_members  enable row level security;
alter table public.party_invites  enable row level security;

-- 데모용 단순 정책: 로그인 사용자면 읽기/쓰기 허용
drop policy if exists "parties_all" on public.parties;
drop policy if exists "pm_all"      on public.party_members;
drop policy if exists "pi_all"      on public.party_invites;
create policy "parties_all" on public.parties       for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "pm_all"      on public.party_members  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "pi_all"      on public.party_invites  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- 4) Realtime(변경 알림) 활성화
do $$ begin
  begin alter publication supabase_realtime add table public.party_invites; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.party_members; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.messages;      exception when duplicate_object then null; end;
end $$;
