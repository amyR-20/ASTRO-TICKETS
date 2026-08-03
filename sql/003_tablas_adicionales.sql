-- ============================================================
-- Astro Tickets — Tablas adicionales (mejora del esquema)
-- Ejecutar DESPUÉS de 001_usuarios.sql y 002_eventos_y_ventas.sql
-- (los archivos ya existentes no se tocan)
-- ============================================================

-- ------------------------------------------------------------
-- CATEGORIAS: catálogo fijo de categorías de eventos
-- (Concierto, Teatro, Deportes, Conferencia...) para que el
-- frontend no escriba categorías libres.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categorias (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(50) UNIQUE NOT NULL,
    color         VARCHAR(9)  DEFAULT '#6c3fd1',
    icono         VARCHAR(50) DEFAULT 'music_note'
);

INSERT INTO categorias (nombre, color, icono) VALUES
    ('Concierto',   '#6c3fd1', 'music_note'),
    ('Teatro',      '#e91e63', 'theater_comedy'),
    ('Deportes',    '#00bcd4', 'sports_soccer'),
    ('Conferencia', '#ff9800', 'record_voice_over'),
    ('Festival',    '#8bc34a', 'celebration'),
    ('Stand-up',    '#9c27b0', 'mic')
ON CONFLICT (nombre) DO NOTHING;

-- ------------------------------------------------------------
-- PAGOS: cada pago asociado a una orden. Hoy los datos de pago
-- viven dentro de "ordenes"; esta tabla los separa y permite
-- rastrear pagos rechazados, pendientes o reembolsados.
-- Alimenta la Salida 8 (transacciones diarias).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pagos (
    id            SERIAL PRIMARY KEY,
    orden_id      INTEGER         NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    transaccion   VARCHAR(40)     UNIQUE NOT NULL,      -- id del gateway (ej. TXN-2026-0001)
    metodo_pago   VARCHAR(20)     NOT NULL,             -- card, paypal, apple, google, transfer
    marca_tarjeta VARCHAR(20),
    ultimos4      VARCHAR(4),
    monto         NUMERIC(10,2)   NOT NULL,
    estado        VARCHAR(20)     NOT NULL DEFAULT 'procesado'
                  CHECK (estado IN ('pendiente', 'procesado', 'fallido', 'reembolsado')),
    pagado_en     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pagos_orden   ON pagos(orden_id);
CREATE INDEX IF NOT EXISTS idx_pagos_estado  ON pagos(estado);
CREATE INDEX IF NOT EXISTS idx_pagos_pagado  ON pagos(pagado_en);

-- ------------------------------------------------------------
-- REEMBOLSOS: devoluciones de dinero sobre una orden/pago.
-- Complementa el estado 'refunded' de ordenes con el detalle
-- (motivo, monto, quién lo autorizó).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reembolsos (
    id            SERIAL PRIMARY KEY,
    orden_id      INTEGER         NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    pago_id       INTEGER         REFERENCES pagos(id) ON DELETE SET NULL,
    monto         NUMERIC(10,2)   NOT NULL,
    motivo        TEXT,
    autorizado_por INTEGER        REFERENCES usuarios(id) ON DELETE SET NULL,  -- admin
    estado        VARCHAR(20)     NOT NULL DEFAULT 'solicitado'
                  CHECK (estado IN ('solicitado', 'aprobado', 'rechazado')),
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reembolsos_orden ON reembolsos(orden_id);

-- ------------------------------------------------------------
-- RESERVAS: asientos apartados temporalmente mientras el usuario
-- paga (el estado 'reserved' de asientos ya existe pero nadie
-- registra quién/desde cuándo). Se limpian al expirar.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reservas (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    asiento_id    VARCHAR(10)     NOT NULL,
    zona          VARCHAR(50),
    precio        NUMERIC(10,2)   NOT NULL DEFAULT 0,
    expira_en     TIMESTAMPTZ     NOT NULL DEFAULT now() + interval '15 minutes',
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (evento_id, asiento_id)
);

CREATE INDEX IF NOT EXISTS idx_reservas_evento   ON reservas(evento_id);
CREATE INDEX IF NOT EXISTS idx_reservas_usuario  ON reservas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_reservas_expira   ON reservas(expira_en);

-- ------------------------------------------------------------
-- CUPONES: códigos de descuento (porcentaje o monto fijo).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupones (
    id            SERIAL PRIMARY KEY,
    codigo        VARCHAR(30)     UNIQUE NOT NULL,
    descripcion   TEXT,
    tipo          VARCHAR(10)     NOT NULL DEFAULT 'porcentaje'
                  CHECK (tipo IN ('porcentaje', 'monto')),
    valor         NUMERIC(10,2)   NOT NULL DEFAULT 0,
    evento_id     TEXT            REFERENCES eventos(id) ON DELETE CASCADE,  -- NULL = todos
    max_usos      INTEGER         DEFAULT NULL,          -- NULL = sin límite
    usos          INTEGER         NOT NULL DEFAULT 0,
    vence_en      DATE,
    activo        BOOLEAN         NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- CUPONES_USADOS: registro de quién usó cada cupón (evita
-- reutilizar el mismo cupón varias veces por el mismo usuario).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupones_usados (
    id            SERIAL PRIMARY KEY,
    cupon_id      INTEGER         NOT NULL REFERENCES cupones(id) ON DELETE CASCADE,
    orden_id      INTEGER         NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    usuario_id    INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
    descuento     NUMERIC(10,2)   NOT NULL,
    usado_en      TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (cupon_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_cupones_usados_orden ON cupones_usados(orden_id);

-- ------------------------------------------------------------
-- FAVORITOS: eventos que el usuario guarda ("me interesa").
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favoritos (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, evento_id)
);

CREATE INDEX IF NOT EXISTS idx_favoritos_usuario ON favoritos(usuario_id);

-- ------------------------------------------------------------
-- RESEÑAS: valoración (1-5) y comentario del usuario tras asistir.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS resenas (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    evento_id     TEXT            NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    calificacion  SMALLINT        NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario    TEXT,
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, evento_id)
);

CREATE INDEX IF NOT EXISTS idx_resenas_evento ON resenas(evento_id);

-- ------------------------------------------------------------
-- NOTIFICACIONES: mensajes por usuario (confirmación de compra,
-- recordatorio del evento, resultado de reembolso...).
-- Soporta la Salida 9 (notificación de confirmación).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notificaciones (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    titulo        VARCHAR(120)    NOT NULL,
    mensaje       TEXT,
    tipo          VARCHAR(20)     NOT NULL DEFAULT 'info'
                  CHECK (tipo IN ('info', 'compra', 'evento', 'reembolso', 'alerta')),
    leida         BOOLEAN         NOT NULL DEFAULT false,
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notificaciones_usuario ON notificaciones(usuario_id, leida);

-- ------------------------------------------------------------
-- AUDITORIA: registro de acciones administrativas (crear/editar/
-- eliminar eventos, reembolsos, cambios de estado). Sirve de
-- evidencia y alimenta los reportes del panel admin.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS auditoria (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
    accion        VARCHAR(50)     NOT NULL,              -- ej. 'evento.crear'
    entidad       VARCHAR(50),                           -- ej. 'eventos'
    entidad_id    TEXT,                                  -- ej. id del evento
    detalle       JSONB,
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auditoria_creado  ON auditoria(creado_en);
CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON auditoria(usuario_id);

-- ------------------------------------------------------------
-- TICKETS_SOPORTE: solicitudes de ayuda del usuario
-- (problema con una compra, cambio de asiento, etc.)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets_soporte (
    id            SERIAL PRIMARY KEY,
    usuario_id    INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    orden_id      INTEGER         REFERENCES ordenes(id) ON DELETE SET NULL,
    asunto        VARCHAR(150)    NOT NULL,
    descripcion   TEXT,
    estado        VARCHAR(20)     NOT NULL DEFAULT 'abierto'
                  CHECK (estado IN ('abierto', 'en_progreso', 'resuelto', 'cerrado')),
    creado_en     TIMESTAMPTZ     NOT NULL DEFAULT now(),
    resuelto_en   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_soporte_usuario ON tickets_soporte(usuario_id);
CREATE INDEX IF NOT EXISTS idx_soporte_estado  ON tickets_soporte(estado);

-- ------------------------------------------------------------
-- Resumen de tablas del proyecto (para verificar en Neon):
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema = 'public' ORDER BY table_name;
-- ------------------------------------------------------------
