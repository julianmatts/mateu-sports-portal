-- ============================================================
-- Control de Recepciones — Depósito Central (Mateu Sports)
-- Migración de la base D1 `mateu_recepciones`.
--
-- Aplicar con:
--   wrangler d1 execute mateu_recepciones --file=./schema.sql
-- (agregar --local para la base de `wrangler pages dev`).
--
-- Convención de datos:
--   * cantidad y costo_unitario se guardan; `importe` es columna GENERATED.
--   * la `semana` del remito se deriva de la fecha (ISO 'Sem NN').
--   * rubro/disciplina/tipo nunca son NULL (default '') para que el cruce
--     del control (v_control) matchee por igualdad sin problemas de NULL.
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- PEDIDOS DE COMPRA (OC) ----------
CREATE TABLE IF NOT EXISTS pedido (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nro        TEXT    NOT NULL UNIQUE,
  fecha      TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  comprador  TEXT    NOT NULL DEFAULT '',
  proveedor  TEXT    NOT NULL DEFAULT '',
  marca      TEXT    NOT NULL DEFAULT '',
  moneda     TEXT    NOT NULL DEFAULT 'ARS',
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pedido_linea (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  pedido_id      INTEGER NOT NULL REFERENCES pedido(id) ON DELETE CASCADE,
  rubro          TEXT    NOT NULL DEFAULT '',
  disciplina     TEXT    NOT NULL DEFAULT '',
  tipo           TEXT    NOT NULL DEFAULT '',
  cantidad       REAL    NOT NULL DEFAULT 0,
  costo_unitario REAL    NOT NULL DEFAULT 0,
  importe        REAL    GENERATED ALWAYS AS (cantidad * costo_unitario) STORED
);

-- ---------- REMITOS DE INGRESO ----------
CREATE TABLE IF NOT EXISTS remito (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  nro        TEXT    NOT NULL UNIQUE,
  fecha      TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  proveedor  TEXT    NOT NULL DEFAULT '',
  marca      TEXT    NOT NULL DEFAULT '',
  pedido_nro TEXT,                             -- OC contra la que ingresa (NULL = sin OC)
  semana     TEXT    GENERATED ALWAYS AS ('Sem ' || strftime('%W', fecha)) STORED,
  creado_en  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS remito_linea (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  remito_id      INTEGER NOT NULL REFERENCES remito(id) ON DELETE CASCADE,
  rubro          TEXT    NOT NULL DEFAULT '',
  disciplina     TEXT    NOT NULL DEFAULT '',
  tipo           TEXT    NOT NULL DEFAULT '',
  cantidad       REAL    NOT NULL DEFAULT 0,
  costo_unitario REAL    NOT NULL DEFAULT 0,
  importe        REAL    GENERATED ALWAYS AS (cantidad * costo_unitario) STORED
);

-- ---------- MAPEOS DE IMPORTACIÓN (editables sin tocar código) ----------
CREATE TABLE IF NOT EXISTS import_mapping (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  marca    TEXT    NOT NULL,
  tipo_doc TEXT    NOT NULL CHECK (tipo_doc IN ('pedido','ingreso')),
  config   TEXT    NOT NULL,                   -- JSON del mapeo (ver import.js)
  UNIQUE (marca, tipo_doc)
);

-- ---------- LOG DE IMPORTACIONES ----------
CREATE TABLE IF NOT EXISTS import_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  archivo   TEXT,
  tipo_doc  TEXT,
  marca     TEXT,
  filas     INTEGER,
  creado_en TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------- ÍNDICES ----------
CREATE INDEX IF NOT EXISTS idx_pedido_linea_dim ON pedido_linea(rubro, disciplina, tipo);
CREATE INDEX IF NOT EXISTS idx_remito_linea_dim ON remito_linea(rubro, disciplina, tipo);
CREATE INDEX IF NOT EXISTS idx_remito_pedido_nro ON remito(pedido_nro);
CREATE INDEX IF NOT EXISTS idx_pedido_marca ON pedido(marca);
CREATE INDEX IF NOT EXISTS idx_remito_marca ON remito(marca);
CREATE INDEX IF NOT EXISTS idx_pedido_linea_pedido ON pedido_linea(pedido_id);
CREATE INDEX IF NOT EXISTS idx_remito_linea_remito ON remito_linea(remito_id);

-- ============================================================
-- VISTA DE CONTROL — Ingresos vs Pedido
-- Por cada línea de pedido (agregada por dimensión) cruza contra lo recibido,
-- matcheando pedido_nro + marca + rubro + disciplina + tipo.
-- Devuelve unidades y $ pedidos, recibidos y pendientes.
-- ============================================================
DROP VIEW IF EXISTS v_control;
CREATE VIEW v_control AS
SELECT
  p.nro                                                  AS pedido_nro,
  p.marca                                                AS marca,
  pl.rubro                                               AS rubro,
  pl.disciplina                                          AS disciplina,
  pl.tipo                                                AS tipo,
  SUM(pl.cantidad)                                       AS cant_pedida,
  SUM(pl.importe)                                        AS importe_pedido,
  COALESCE(r.cant_recibida, 0)                           AS cant_recibida,
  COALESCE(r.importe_recibido, 0)                        AS importe_recibido,
  SUM(pl.cantidad) - COALESCE(r.cant_recibida, 0)        AS cant_pendiente,
  SUM(pl.importe)  - COALESCE(r.importe_recibido, 0)     AS importe_pendiente
FROM pedido p
JOIN pedido_linea pl ON pl.pedido_id = p.id
LEFT JOIN (
  SELECT
    rem.pedido_nro,
    rem.marca,
    rl.rubro,
    rl.disciplina,
    rl.tipo,
    SUM(rl.cantidad) AS cant_recibida,
    SUM(rl.importe)  AS importe_recibido
  FROM remito rem
  JOIN remito_linea rl ON rl.remito_id = rem.id
  WHERE rem.pedido_nro IS NOT NULL AND rem.pedido_nro <> ''
  GROUP BY rem.pedido_nro, rem.marca, rl.rubro, rl.disciplina, rl.tipo
) r
  ON  r.pedido_nro = p.nro
  AND r.marca      = p.marca
  AND r.rubro      = pl.rubro
  AND r.disciplina = pl.disciplina
  AND r.tipo       = pl.tipo
GROUP BY p.nro, p.marca, pl.rubro, pl.disciplina, pl.tipo;
