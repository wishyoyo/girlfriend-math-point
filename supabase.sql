-- 在 Supabase SQL Editor 執行本檔，再到 Authentication 建立兩個 Email 使用者。
-- 最後將下方 profiles 的 email 與 couple_code 改成你們自己的值。

create extension if not exists "pgcrypto";

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text not null,
  role text not null check (role in ('boyfriend', 'girlfriend')),
  couple_code text not null,
  created_at timestamptz not null default now()
);

create table public.study_records (
  id uuid primary key default gen_random_uuid(),
  couple_code text not null,
  study_date date not null,
  book_type text not null check (book_type in ('lecture', 'workbook', 'english_daily', 'english_quiz')),
  chapter_name text not null,
  items jsonb not null default '{}'::jsonb,
  points numeric(8,1) not null default 0,
  correct_count integer not null default 0,
  attempted_count integer not null default 0,
  chapter_complete boolean not null default false,
  past_bonus boolean not null default false,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_by uuid references public.profiles(id),
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  couple_code text not null,
  reward_id text not null,
  reward_name text not null,
  points numeric(8,1) not null,
  redeemed_by uuid references public.profiles(id),
  redeemed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.study_records enable row level security;
alter table public.redemptions enable row level security;

create policy "read own profile" on public.profiles for select
  using (id = auth.uid());

create policy "couple reads records" on public.study_records for select
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

create policy "couple creates records" on public.study_records for insert
  with check (
    couple_code = (select couple_code from public.profiles where id = auth.uid())
    and submitted_by = auth.uid()
  );

create policy "boyfriend approves records" on public.study_records for update
  using (
    couple_code = (select couple_code from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'boyfriend'
  )
  with check (
    couple_code = (select couple_code from public.profiles where id = auth.uid())
    and (select role from public.profiles where id = auth.uid()) = 'boyfriend'
  );

create policy "couple reads redemptions" on public.redemptions for select
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

create policy "couple creates redemptions" on public.redemptions for insert
  with check (
    couple_code = (select couple_code from public.profiles where id = auth.uid())
    and redeemed_by = auth.uid()
  );

create policy "couple deletes records" on public.study_records for delete
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

create policy "couple deletes redemptions" on public.redemptions for delete
  using (couple_code = (select couple_code from public.profiles where id = auth.uid()));

-- 建立 Auth 使用者後執行。請替換 email、name、role 與你們共用的 couple_code。
-- insert into public.profiles (id, email, name, role, couple_code)
-- select id, email, '你的名字', 'boyfriend', 'OUR-SECRET-CODE' from auth.users where email = 'your@email.com';
--
-- insert into public.profiles (id, email, name, role, couple_code)
-- select id, email, '女友名字', 'girlfriend', 'OUR-SECRET-CODE' from auth.users where email = 'her@email.com';

-- 如果你之前已經建立過 study_records，請另外執行下面兩行，讓「不確認」狀態可以寫入。
-- alter table public.study_records drop constraint if exists study_records_status_check;
-- alter table public.study_records add constraint study_records_status_check check (status in ('pending', 'approved', 'rejected'));

-- 如果你之前已經建立過 study_records，也請執行下面兩行，讓英文單字紀錄可以寫入。
-- alter table public.study_records drop constraint if exists study_records_book_type_check;
-- alter table public.study_records add constraint study_records_book_type_check check (book_type in ('lecture', 'workbook', 'english_daily', 'english_quiz'));

-- 如果你之前已經建立過資料庫，也請執行 supabase-update.sql，更新舊約束並加入刪除權限。
