/* ============================================================
   Astro Tickets — sql/011_mejoras_preferencias_y_reembolsos.sql
   Mejoras elegidas del esquema:
     (1)  datos del comprador capturados al momento de la compra
     (6)  idioma/tema persistidos por usuario
     (7)  recintos y artistas (catálogo + FK en eventos)
     (9)  FK real de eventos.categoria -> categorias
     (13) transferencia de boletos + lista de espera
   + modelo funcional de REEMBOLSOS (tabla creada en 003).
   No destructivo: ALTER ... IF NOT EXISTS + backfill. Sin DROP.
   ============================================================ */

BEGIN;

-- ------------------------------------------------------------
-- (1) DATOS DEL COMPRADOR en ordenes (JSONB)
-- ------------------------------------------------------------
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS datos_comprador JSONB;

-- Backfill: completar los datos del comprador desde el perfil actual.
UPDATE ordenes o
   SET datos_comprador = jsonb_build_object('nombre', u.nombre, 'email', u.email)
  FROM usuarios u
 WHERE o.usuario_id = u.id
   AND o.datos_comprador IS NULL;

-- ------------------------------------------------------------
-- (6) PREFERENCIAS de idioma/tema por usuario
-- ------------------------------------------------------------
ALTER TABLE usuarios
  ADD COLUMN IF NOT EXISTS idioma_pref VARCHAR(10) NOT NULL DEFAULT 'es',
  ADD COLUMN IF NOT EXISTS tema_pref   VARCHAR(10) NOT NULL DEFAULT 'auto';

-- ------------------------------------------------------------
-- (7) RECINTOS: sedes donde se presentan los eventos
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recintos (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL UNIQUE,
    ciudad      VARCHAR(100),
    capacidad   INTEGER      NOT NULL DEFAULT 0,
    descripcion TEXT,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO recintos (nombre, ciudad, capacidad, descripcion) VALUES
    ('Teatro Nacional Eduardo Brito', 'Santo Domingo', 1700, 'Teatro principal del país.'),
    ('Palacio de los Deportes Virgilio Travieso Soto', 'Santo Domingo', 5500, 'Arena multiusos.'),
    ('Estadio Olímpico Félix Sánchez', 'Santo Domingo', 27000, 'Estadio de atletismo y grandes conciertos.'),
    ('Parque del Este', 'Santo Domingo', 15000, 'Espacio abierto para festivales.'),
    ('Teatro La Fiesta del Hotel Jaragua', 'Santo Domingo', 2000, 'Salón para conciertos y shows.'),
    ('Sala Ravelo del Teatro Nacional', 'Santo Domingo', 300, 'Sala de cámara.')
ON CONFLICT (nombre) DO NOTHING;

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS recinto_id INTEGER REFERENCES recintos(id);

-- ------------------------------------------------------------
-- (7) ARTISTAS: intérpretes / agrupaciones + relación N:M
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS artistas (
    id          SERIAL PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL UNIQUE,
    genero      VARCHAR(80),
    foto        TEXT,
    descripcion TEXT,
    creado_en   TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO artistas (nombre, genero) VALUES
    ('Michel Camilo',        'Jazz'),
    ('Juan Luis Guerra',     'Merengue'),
    ('Rita Indiana',         'Alternativo'),
    ('Sinfónica Nacional',   'Clásica'),
    ('Compañía Nacional de Teatro', 'Teatro'),
    ('Luis "El Terror" Díaz','Merengue'),
    ('Stand-up Dominicano',  'Stand-up')
ON CONFLICT (nombre) DO NOTHING;

CREATE TABLE IF NOT EXISTS evento_artistas (
    evento_id  TEXT    NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
    artista_id INTEGER NOT NULL REFERENCES artistas(id) ON DELETE CASCADE,
    posicion   INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (evento_id, artista_id)
);

CREATE INDEX IF NOT EXISTS idx_evento_artistas_artista ON evento_artistas(artista_id);

-- ------------------------------------------------------------
-- (9) FK REAL de categorias (texto libre -> fila de categorias)
-- ------------------------------------------------------------
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS categoria_id INTEGER REFERENCES categorias(id);

-- Asegurar una fila de categoría por cada texto libre existente.
INSERT INTO categorias (nombre)
SELECT DISTINCT e.categoria
  FROM eventos e
 WHERE e.categoria IS NOT NULL AND e.categoria <> ''
   AND NOT EXISTS (SELECT 1 FROM categorias c WHERE c.nombre = e.categoria);

-- Asociar los eventos existentes a su categoría.
UPDATE eventos e
   SET categoria_id = c.id
  FROM categorias c
 WHERE e.categoria_id IS NULL
   AND e.categoria = c.nombre;

-- ------------------------------------------------------------
-- (13) TRANSFERENCIA DE BOLETOS
-- ------------------------------------------------------------
ALTER TABLE entradas ADD COLUMN IF NOT EXISTS transferida_a_id INTEGER
  REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS transferencias_entradas (
    id                SERIAL PRIMARY KEY,
    entrada_id        INTEGER      NOT NULL REFERENCES entradas(id) ON DELETE CASCADE,
    orden_id          INTEGER      NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
    usuario_origen_id INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
    email_destino     VARCHAR(200) NOT NULL,
    token             VARCHAR(40)  UNIQUE,
    estado            VARCHAR(20)  NOT NULL DEFAULT 'pendiente'
                      CHECK (estado IN ('pendiente', 'completada', 'cancelada')),
    creado_en         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    completado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_transferencias_entrada ON transferencias_entradas(entrada_id);
CREATE INDEX IF NOT EXISTS idx_transferencias_estado ON transferencias_entradas(estado);

-- ------------------------------------------------------------
-- (13) LISTA DE ESPERA (avísame cuando haya boletos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS lista_espera (
    id         SERIAL PRIMARY KEY,
    usuario_id INTEGER     NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    funcion_id INTEGER     NOT NULL REFERENCES funciones_evento(id) ON DELETE CASCADE,
    notificado BOOLEAN     NOT NULL DEFAULT false,
    creado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (usuario_id, funcion_id)
);

CREATE INDEX IF NOT EXISTS idx_lista_espera_funcion ON lista_espera(funcion_id);

-- ------------------------------------------------------------
-- REEMBOLSOS: completar la tabla creada en 003 con la fecha en
-- que el reembolso se procesó y un índice por estado.
-- ------------------------------------------------------------
ALTER TABLE reembolsos ADD COLUMN IF NOT EXISTS completado_en TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_reembolsos_estado ON reembolsos(estado);

COMMIT;
