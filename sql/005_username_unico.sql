BEGIN;
CREATE EXTENSION IF NOT EXISTS unaccent;
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS username VARCHAR(24);
WITH base AS (
  SELECT id,
    LEFT(COALESCE(NULLIF(regexp_replace(lower(unaccent(nombre)), '[^a-z0-9]+', '_', 'g'), ''), 'usuario'), 18) AS slug,
    ROW_NUMBER() OVER (PARTITION BY LEFT(COALESCE(NULLIF(regexp_replace(lower(unaccent(nombre)), '[^a-z0-9]+', '_', 'g'), ''), 'usuario'), 18) ORDER BY id) AS n
  FROM usuarios
)
UPDATE usuarios u SET username=base.slug || CASE WHEN base.n=1 THEN '' ELSE '_' || base.n END
FROM base WHERE u.id=base.id AND u.username IS NULL;
ALTER TABLE usuarios ALTER COLUMN username SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_username_lower_uniq ON usuarios (lower(username));
COMMIT;
