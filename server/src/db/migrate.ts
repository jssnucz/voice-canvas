import type pg from 'pg';

const CREATE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS diagrams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL DEFAULT '未命名图表',
  mode        VARCHAR(20) NOT NULL DEFAULT 'flowchart',
  state       JSONB NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
`;

export async function migrate(pool: pg.Pool): Promise<void> {
  await pool.query(CREATE_TABLE_SQL);
}
