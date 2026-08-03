-- Widen icon columns from VARCHAR(50) to TEXT so users can store
-- arbitrary values (emoji, text labels, or image URLs).
ALTER TABLE organizations ALTER COLUMN icon TYPE TEXT;
ALTER TABLE spaces ALTER COLUMN icon TYPE TEXT;
ALTER TABLE collections ALTER COLUMN icon TYPE TEXT;
