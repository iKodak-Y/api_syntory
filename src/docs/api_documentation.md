# Documentación de la API

## Estados del Sistema

### Estados de Factura Electrónica
- 'P' - Pendiente: Factura recién creada
- 'E' - Enviada: Factura enviada al SRI
- 'A' - Autorizada: Factura autorizada por el SRI
- 'R' - Rechazada: Factura rechazada por el SRI
- 'N' - Anulada: Factura anulada en el SRI
- 'X' - Error: Error en el proceso

### Estados de Clientes y Productos
- 'A' - Activo
- 'I' - Inactivo

## Endpoints

### Clientes (`/api/clients`)

#### GET /api/clients
- Descripción: Obtiene todos los clientes activos
- Filtros: estado = 'S'
- Ordenamiento: Por ID de cliente

#### GET /api/clients/:id 
- Descripción: Obtiene un cliente específico por ID

#### GET /api/clients/search/:identification
- Descripción: Busca un cliente por número de identificación (cédula/RUC)
- Filtros: estado = 'S'

#### POST /api/clients
- Descripción: Crea un nuevo cliente
- Campos requeridos:
  - nombre
  - cedula_ruc
- Validaciones:
  - Identificación única
  - Estado por defecto: 'S'

#### PUT /api/clients/:id
- Descripción: Actualiza información del cliente
- Validaciones:
  - Cliente debe existir
  - No se puede modificar la identificación

#### DELETE /api/clients/:id
- Descripción: Eliminación lógica del cliente
- Validaciones:
  - No debe tener facturas asociadas
  - Cambia estado a 'N'

### Facturas (`/api/bill`)

#### GET /api/bill
- Descripción: Lista todas las facturas
- Incluye:
  - Información del cliente
  - Información del emisor
  - Usuario que emitió
  - Detalles y totales

#### GET /api/bill/:id
- Descripción: Obtiene una factura específica con todos sus detalles

#### GET /api/bill/last-number/:emisorId/:puntoEmision
- Descripción: Obtiene el siguiente número secuencial para una factura

#### POST /api/bill
- Descripción: Crea una nueva factura
- Campos requeridos:
  - id_emisor
  - id_cliente
  - id_usuario
  - punto_emision
  - detalles
  - formas_pago
- Proceso:
  - Genera número secuencial
  - Genera clave de acceso
  - Crea factura en estado 'P'
  - Registra detalles y formas de pago

#### PUT /api/bill/:id/status
- Descripción: Actualiza el estado de una factura
- Estados válidos: P, E, A, R, N, X
- Campos adicionales:
  - fecha_autorizacion
  - xml_autorizado
  - pdf_path

#### PUT /api/bill/:id/void
- Descripción: Anula una factura
- Requiere:
  - motivo de anulación
- Proceso:
  - Registra en log_errores_factura
  - Actualiza estado a 'N'

### Productos (`/api/productos`)

[Lista de endpoints de productos]

### Categorías (`/api/category`)

[Lista de endpoints de categorías]

### Emisor (`/api/emisor`)

[Lista de endpoints de emisor]

### Menú (`/api/menu`)

[Lista de endpoints de menú]

## Recomendaciones de Cambios en Base de Datos

Para implementar estos cambios en los estados, se recomienda:

1. Actualizar la tabla `factura_electronica`:
```sql
-- Modificar la columna estado para aceptar los nuevos valores
ALTER TABLE factura_electronica 
DROP CONSTRAINT IF EXISTS chk_factura_estado;

ALTER TABLE factura_electronica
ADD CONSTRAINT chk_factura_estado 
CHECK (estado IN ('P', 'E', 'A', 'R', 'N', 'X'));

-- Actualizar registros existentes
UPDATE factura_electronica 
SET estado = 'A' 
WHERE estado = 'A' AND fecha_autorizacion IS NOT NULL;

UPDATE factura_electronica 
SET estado = 'P' 
WHERE estado = 'A' AND fecha_autorizacion IS NULL;
```

2. Actualizar las tablas `clientes` y `productos`:
```sql
-- Modificar las columnas estado
ALTER TABLE clientes 
DROP CONSTRAINT IF EXISTS chk_clientes_estado;

ALTER TABLE clientes
ADD CONSTRAINT chk_clientes_estado 
CHECK (estado IN ('S', 'N'));

UPDATE clientes 
SET estado = 'S' 
WHERE estado = 'A';

UPDATE clientes 
SET estado = 'N' 
WHERE estado = 'I';

-- Repetir para la tabla productos
ALTER TABLE productos 
DROP CONSTRAINT IF EXISTS chk_productos_estado;

ALTER TABLE productos
ADD CONSTRAINT chk_productos_estado 
CHECK (estado IN ('S', 'N'));

UPDATE productos 
SET estado = 'S' 
WHERE estado = 'A';

UPDATE productos 
SET estado = 'N' 
WHERE estado = 'I';
```
