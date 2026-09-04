-- TeamFlow shared workspace schema (Postgres / Neon Data API).
--
-- Run this once against the database that backs EXPO_PUBLIC_DATA_API_URL.
-- Column names are snake_case; the app converts to camelCase at the storage
-- boundary (src/cloud.ts). There is no per-user login: every visitor uses an
-- anonymous token and shares the same rows, which is the point of a team board.

create table if not exists projects (
  id          text primary key,
  name        text not null default '',
  description text not null default '',
  status      text not null default 'Planning',
  color       text not null default '#4F46E5',
  start_date  text not null default '',
  target_date text not null default '',
  owner_id    text not null default '',
  created_at  text not null default ''
);

create table if not exists tasks (
  id          text primary key,
  project_id  text not null default '',
  title       text not null default '',
  description text not null default '',
  type        text not null default 'Task',
  status      text not null default 'Backlog',
  priority    text not null default 'Medium',
  assignee_id text not null default '',
  due_date    text not null default '',
  labels      jsonb not null default '[]'::jsonb,
  sort_order  integer not null default 0,
  created_at  text not null default '',
  updated_at  text not null default ''
);

create index if not exists tasks_project_id_idx on tasks (project_id);
create index if not exists tasks_status_idx on tasks (status);

create table if not exists subtasks (
  id         text primary key,
  task_id    text not null default '',
  title      text not null default '',
  done       boolean not null default false,
  created_at text not null default ''
);

create index if not exists subtasks_task_id_idx on subtasks (task_id);

create table if not exists comments (
  id         text primary key,
  task_id    text not null default '',
  author_id  text not null default '',
  body       text not null default '',
  created_at text not null default ''
);

create index if not exists comments_task_id_idx on comments (task_id);

-- Users module: the team directory every screen assigns work against.
create table if not exists members (
  id         text primary key,
  name       text not null default '',
  email      text not null default '',
  role       text not null default 'Member',
  initials   text not null default '',
  color      text not null default '#4F46E5',
  active     boolean not null default true,
  created_at text not null default ''
);

-- Upgrades a database created before the users module shipped.
alter table members add column if not exists email      text not null default '';
alter table members add column if not exists role       text not null default 'Member';
alter table members add column if not exists active     boolean not null default true;
alter table members add column if not exists created_at text not null default '';
alter table projects add column if not exists owner_id  text not null default '';

create table if not exists activities (
  id           text primary key,
  actor_id     text not null default '',
  action       text not null default '',
  target_type  text not null default 'task',
  target_id    text not null default '',
  target_title text not null default '',
  created_at   text not null default ''
);

create index if not exists activities_created_at_idx on activities (created_at desc);

-- Expose the tables through the Data API for the anonymous role.
do $$
declare
  t text;
begin
  foreach t in array array['projects', 'tasks', 'subtasks', 'comments', 'members', 'activities']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('grant select, insert, update, delete on table %I to anonymous, authenticated', t);
    execute format(
      'create policy %I on %I for all to anonymous, authenticated using (true) with check (true)',
      t || '_shared_access', t
    );
  end loop;
exception
  when duplicate_object then null; -- policies already created
end
$$;
