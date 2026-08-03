-- ============================================================
-- Astro Tickets — Esquema completo (eventos + ventas)
-- Tablas: eventos, zonas, asientos, ordenes, entradas
-- Ejecutar contra la base de Neon (neondb)
-- ============================================================

-- ------------------------------------------------------------
-- EVENTOS: cada evento creado (draft o publicado)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS eventos (
    id            TEXT PRIMARY KEY,
    nombre        VARCHAR(200)    NOT NULL,
    descripcion   TEXT,
    categoria     VARCHAR(50),
    fecha         DATE,
    hora          TIME,
    lugar         VARCHAR(200),
    ciudad        VARCHAR(100),
    direccion     TEXT,
    imagen        TEXT,
    estado        VARCHAR(20)     NOT NULL DEFAULT 'draft'
                  CHECK (estado IN ('draft', 'published', 'cancelado')),
    filas         INTEGER         DEFAULT 0,
    columnas      INTEGER         DEFAULT 0,
    capacidad     INTEGER         DEFAULT 0,
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos(estado);

-- ------------------------------------------------------------
-- ZONAS: tipos de entrada de cada evento (Platino, VIP, General...)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS zonas (
    id            SERIAL PRIMARY KEY,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    nombre        VARCHAR(50)     NOT NULL,
    color         VARCHAR(9)      DEFAULT '#6c3fd1',
    precio        NUMERIC(10,2)   NOT NULL DEFAULT 0,
    cantidad      INTEGER         DEFAULT 0,
    descripcion   TEXT
);

CREATE INDEX IF NOT EXISTS idx_zonas_evento ON zonas(evento_id);

-- ------------------------------------------------------------
-- ASIENTOS: cada asiento de la sala de cada evento
-- (A1, A2, ... con su zona asignada y estado)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS asientos (
    id            SERIAL PRIMARY KEY,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    asiento_id    VARCHAR(10)     NOT NULL,            -- ej: "A1"
    fila          VARCHAR(2)      NOT NULL,            -- ej: "A"
    columna       INTEGER         NOT NULL,            -- ej: 1
    zona          VARCHAR(50),                         -- nombre de la zona (tipos)
    estado        VARCHAR(20)     NOT NULL DEFAULT 'available'
                  CHECK (estado IN ('available', 'reserved', 'blocked', 'sold')),
    UNIQUE (evento_id, asiento_id)
);

CREATE INDEX IF NOT EXISTS idx_asientos_evento ON asientos(evento_id);

-- ------------------------------------------------------------
-- ORDENES: cada compra realizada (una por pago)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ordenes (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
    evento_id       TEXT            NOT NULL REFERENCES eventos(id),
    transaccion     VARCHAR(40)     UNIQUE,             -- ej: TXN-2026-...
    codigo_reserva  VARCHAR(20)     UNIQUE,             -- ej: RSV-...
    metodo_pago     VARCHAR(20),                        -- card, paypal, apple, google, transfer
    tarjeta_marca   VARCHAR(20),
    tarjeta_ultimos4 VARCHAR(4),
    subtotal        NUMERIC(10,2)   NOT NULL DEFAULT 0,
    tarifa          NUMERIC(10,2)   NOT NULL DEFAULT 0,
    total           NUMERIC(10,2)   NOT NULL DEFAULT 0,
    estado          VARCHAR(20)     NOT NULL DEFAULT 'paid'
                    CHECK (estado IN ('paid', 'pending', 'cancelled', 'refunded', 'completed')),
    creada_en       TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ordenes_usuario ON ordenes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_evento  ON ordenes(evento_id);

-- ------------------------------------------------------------
-- ENTRADAS: cada boleto individual dentro de una orden
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS entradas (
    id            SERIAL PRIMARY KEY,
    orden_id      INTEGER         NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id),
    asiento_id    VARCHAR(10)     NOT NULL,             -- ej: "G4"
    zona          VARCHAR(50),
    precio        NUMERIC(10,2)   NOT NULL DEFAULT 0,
    estado        VARCHAR(20)     NOT NULL DEFAULT 'activa'
                  CHECK (estado IN ('activa', 'usada', 'cancelada')),
    UNIQUE (evento_id, asiento_id)
);

CREATE INDEX IF NOT EXISTS idx_entradas_orden ON entradas(orden_id);
CREATE INDEX IF NOT EXISTS idx_entradas_evento ON entradas(evento_id);
