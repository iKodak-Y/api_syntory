# Documentación de Controladores y Rutas

## Estructura del Sistema
```
src/
  controllers/     # Controladores de la aplicación
  routes/         # Rutas de la API
  services/       # Servicios (SRI, etc.)
  database/       # Conexión a la base de datos
```

## Controladores

### 1. Facturación (invoices.controllers.js)
```javascript
import { getConnection } from "../database/connection.js";
import SRIService from '../services/sri.service.js';

// Obtener todas las facturas
export const getInvoices = async (req, res) => {
  // ...código del controlador...
};

// Obtener factura por ID
export const getBill = async (req, res) => {
  // ...código del controlador...
};

// Crear nueva factura
export const createInvoice = async (req, res) => {
  // ...código del controlador...
};

// Actualizar estado de factura
export const updateInvoiceStatus = async (req, res) => {
  // ...código del controlador...
};

// Anular factura
export const voidInvoice = async (req, res) => {
  // ...código del controlador...
};

// Procesar factura con SRI
export const procesarFactura = async (req, res) => {
  // ...código del controlador...
};
```

### 2. Clientes (clients.controllers.js)
```javascript
import { getConnection } from "../database/connection.js";

// Obtener todos los clientes activos
export const getClients = async (req, res) => {
  // ...código del controlador...
};

// Obtener cliente por ID
export const getClient = async (req, res) => {
  // ...código del controlador...
};

// Buscar cliente por identificación
export const findClientByIdentification = async (req, res) => {
  // ...código del controlador...
};

// Crear nuevo cliente
export const createClient = async (req, res) => {
  // ...código del controlador...
};

// Actualizar cliente
export const updateClient = async (req, res) => {
  // ...código del controlador...
};

// Eliminar cliente
export const deleteClient = async (req, res) => {
  // ...código del controlador...
};
```

### 3. Productos (products.controllers.js)
```javascript
import { getConnection } from "../database/connection.js";

// Obtener todos los productos
export const getProducts = async (req, res) => {
  // ...código del controlador...
};

// Obtener producto por ID
export const getProduct = async (req, res) => {
  // ...código del controlador...
};

// Crear nuevo producto
export const createProduct = async (req, res) => {
  // ...código del controlador...
};

// Actualizar producto
export const updateProduct = async (req, res) => {
  // ...código del controlador...
};

// Eliminar producto
export const deleteProduct = async (req, res) => {
  // ...código del controlador...
};
```

### 4. Emisor (emisor.controllers.js)
```javascript
import { getConnection } from "../database/connection.js";

// Obtener todos los emisores
export const getEmisores = async (req, res) => {
  // ...código del controlador...
};

// Obtener emisor por ID
export const getEmisor = async (req, res) => {
  // ...código del controlador...
};
```

## Rutas

### 1. Rutas de Facturación (invoices.routes.js)
```javascript
import { Router } from "express";
import { 
    getBill, 
    getInvoices, 
    getLastInvoiceNumber,
    createInvoice,
    updateInvoiceStatus,
    voidInvoice,
    procesarFactura
} from "../controllers/invoices.controllers.js";

const router = Router();

// Consultas
router.get("/bill", getInvoices);
router.get("/bill/:id", getBill);
router.get("/bill/last-number/:emisorId/:puntoEmision", getLastInvoiceNumber);

// Operaciones
router.post("/bill", createInvoice);
router.put("/bill/:id/status", updateInvoiceStatus);
router.put("/bill/:id/void", voidInvoice);
router.post("/bill/:id/process", procesarFactura);

export default router;
```

### 2. Rutas de Clientes (clients.routes.js)
```javascript
import { Router } from 'express';
import { 
    getClients, 
    getClient, 
    createClient, 
    updateClient, 
    deleteClient,
    findClientByIdentification 
} from '../controllers/clients.controllers.js';

const router = Router();

router.get("/clients", getClients);
router.get("/clients/:id", getClient);
router.get("/clients/search/:identification", findClientByIdentification);
router.post("/clients", createClient);
router.put("/clients/:id", updateClient);
router.delete("/clients/:id", deleteClient);

export default router;
```

### 3. Rutas de Productos (products.routes.js)
```javascript
import { Router } from 'express';
import { 
    createProduct, 
    deleteProduct, 
    getProduct, 
    getProducts, 
    updateProduct 
} from '../controllers/products.controllers.js';

const router = Router();

router.get("/productos", getProducts);
router.get("/productos/:id", getProduct);
router.post("/productos", createProduct);
router.put("/productos/:id", updateProduct);
router.delete("/productos/:id", deleteProduct);

export default router;
```

### 4. Rutas del Emisor (emisor.routes.js)
```javascript
import { Router } from 'express';
import { getEmisor, getEmisores } from '../controllers/emisor.controllers.js';

const router = Router();

router.get("/emisor", getEmisores);
router.get("/emisor/:id", getEmisor);

export default router;
```

## Servicio SRI (sri.service.js)

El servicio SRI maneja toda la lógica de facturación electrónica:

1. Generación de XML según esquema XSD del SRI
2. Firma electrónica con certificado .p12
3. Envío de comprobantes al SRI
4. Autorización de comprobantes
5. Generación de PDFs (RIDE)
6. Almacenamiento de comprobantes

La implementación completa se encuentra en `src/services/sri.service.js`

## Estados del Sistema

### Estados de Factura
- 'P' - Pendiente
- 'E' - Enviada al SRI
- 'A' - Autorizada
- 'R' - Rechazada
- 'N' - Anulada
- 'X' - Error

### Estados de Clientes y Productos
- 'S' - Activo
- 'N' - Inactivo

## Estructura de Archivos

Los comprobantes electrónicos se almacenan en:

```
comprobantes/
  ├── no-firmados/    # XMLs generados sin firma
  ├── firmados/       # XMLs con firma electrónica
  ├── autorizados/    # XMLs autorizados por el SRI
  └── pdf/           # RIDEs en formato PDF
```
