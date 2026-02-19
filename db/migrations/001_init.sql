CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS members (
  telegram_user_id bigint PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  is_enabled boolean NOT NULL DEFAULT true,
  note text
);

CREATE TABLE IF NOT EXISTS points (
  id bigserial PRIMARY KEY,
  geom geography(Point, 4326) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint NOT NULL REFERENCES members(telegram_user_id),
  last_refreshed_at timestamptz NOT NULL DEFAULT now(),
  last_updated_by bigint NOT NULL REFERENCES members(telegram_user_id),
  expires_at timestamptz NOT NULL,
  refresh_count integer NOT NULL DEFAULT 1,
  comments_count integer NOT NULL DEFAULT 0,
  is_hidden boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS points_geom_idx ON points USING GIST (geom);
CREATE INDEX IF NOT EXISTS points_expires_idx ON points (expires_at);
CREATE INDEX IF NOT EXISTS points_visible_idx ON points (is_hidden);

CREATE TABLE IF NOT EXISTS point_comments (
  id bigserial PRIMARY KEY,
  point_id bigint NOT NULL REFERENCES points(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by bigint NOT NULL REFERENCES members(telegram_user_id),
  body text NOT NULL,
  is_hidden boolean NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS point_comments_point_id_idx ON point_comments(point_id);
