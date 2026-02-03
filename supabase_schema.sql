-- Run this in your Supabase SQL Editor

-- Create Categories Table
create table public.categories (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  color text not null,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create Receipts Table
create table public.receipts (
  id uuid default gen_random_uuid() primary key,
  establishment text not null,
  receipt_number text,
  date date not null,
  total_amount numeric not null,
  cnpj text,
  location text default 'Caratinga', -- 'Caratinga' or 'Ponte Nova'
  category_id uuid references public.categories(id) on delete set null,
  payment_method text,
  items jsonb default '[]'::jsonb,
  image_url text, -- We will store Base64 in this demo for simplicity, or URL if using Storage
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Insert Default Categories
insert into public.categories (name, color, is_default) values
('Alimentação', '#EF4444', true),
('Transporte', '#3B82F6', true),
('Saúde', '#10B981', true),
('Moradia', '#F59E0B', true),
('Lazer', '#8B5CF6', true),
('Educação', '#EC4899', true),
('Vestuário', '#6366F1', true),
('Outros', '#6B7280', true);