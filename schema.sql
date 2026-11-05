-- THE CLASS FILES: run this entire script in Supabase Dashboard > SQL Editor.
-- This schema uses Supabase Auth + Row Level Security. Do not disable RLS.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_path text,
  recovery_email text,
  created_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null default '' check (char_length(content) <= 3000),
  media_path text,
  media_type text,
  created_at timestamptz not null default now(),
  constraint post_has_content_or_media check (length(trim(content)) > 0 or media_path is not null)
);

create table if not exists public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts(created_at desc);
create index if not exists posts_user_id_idx on public.posts(user_id);
create index if not exists comments_post_id_idx on public.comments(post_id);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.comments enable row level security;

-- Profiles: signed-in members can see the class directory; each member edits only their own profile.
drop policy if exists "Members can view profiles" on public.profiles;
create policy "Members can view profiles" on public.profiles for select to authenticated using (true);
drop policy if exists "Users can create own profile" on public.profiles;
create policy "Users can create own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Posts: all signed-in members can read; only the author can create/update/delete their own.
drop policy if exists "Members can read posts" on public.posts;
create policy "Members can read posts" on public.posts for select to authenticated using (true);
drop policy if exists "Members can create own posts" on public.posts;
create policy "Members can create own posts" on public.posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors can update own posts" on public.posts;
create policy "Authors can update own posts" on public.posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Authors can delete own posts" on public.posts;
create policy "Authors can delete own posts" on public.posts for delete to authenticated using (auth.uid() = user_id);

-- Likes: visible to members; a member can add/remove only their own like.
drop policy if exists "Members can read likes" on public.post_likes;
create policy "Members can read likes" on public.post_likes for select to authenticated using (true);
drop policy if exists "Members can like as themselves" on public.post_likes;
create policy "Members can like as themselves" on public.post_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Members can unlike as themselves" on public.post_likes;
create policy "Members can unlike as themselves" on public.post_likes for delete to authenticated using (auth.uid() = user_id);

-- Comments: visible to members; users can create/delete their own comments.
drop policy if exists "Members can read comments" on public.comments;
create policy "Members can read comments" on public.comments for select to authenticated using (true);
drop policy if exists "Members can create own comments" on public.comments;
create policy "Members can create own comments" on public.comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Authors can delete own comments" on public.comments;
create policy "Authors can delete own comments" on public.comments for delete to authenticated using (auth.uid() = user_id);

-- Create a PRIVATE storage bucket. Images/videos are delivered using short-lived signed URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('class-media', 'class-media', false, 41943040,
  array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 41943040,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members can view class media" on storage.objects;
create policy "Members can view class media" on storage.objects for select to authenticated
using (bucket_id = 'class-media');

drop policy if exists "Members upload into own folder" on storage.objects;
create policy "Members upload into own folder" on storage.objects for insert to authenticated
with check (bucket_id = 'class-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members update own media" on storage.objects;
create policy "Members update own media" on storage.objects for update to authenticated
using (bucket_id = 'class-media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'class-media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members delete own media" on storage.objects;
create policy "Members delete own media" on storage.objects for delete to authenticated
using (bucket_id = 'class-media' and (storage.foldername(name))[1] = auth.uid()::text);

-- IMPORTANT AUTH SETUP:
-- In Supabase Dashboard > Authentication > Providers > Email:
-- turn OFF "Confirm email" for this demo because the app uses a generated email alias
-- (username@users.classfiles.app) to provide username/password login.
-- This alias is not a real inbox. Password reset by email will not work.
-- For a public production site, use a real verified email flow or a secure Edge Function
-- for username-based authentication and account recovery.
