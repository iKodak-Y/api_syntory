import { Router } from "express";
import {
    emitirFacturaElectronica,
    consultarEstadoFacturaSRI,
    obtenerSecuencial
} from "../controllers/facturacion-electronica.controllers.js";
import { createInvoice } from "../controllers/invoices.controllers.js";

const router = Router();

// Rutas para facturación electrónica - USANDO NUESTRO GENERADOR XML PERSONALIZADO
router.post("/facturacion/emitir", createInvoice); // Cambiado a nuestro controller
router.get("/facturacion/estado/:clave_acceso", consultarEstadoFacturaSRI);
router.get("/facturacion/secuencial/:emisorId/:puntoEmision", obtenerSecuencial);

export default router;
