import { Router } from "express";
import {
    emitirFacturaElectronica,
    consultarEstadoFacturaSRI,
    obtenerSecuencial
} from "../controllers/facturacion-electronica.controllers.js";

const router = Router();

// Rutas para facturación electrónica
router.post("/facturacion/emitir", emitirFacturaElectronica);
router.get("/facturacion/estado/:clave_acceso", consultarEstadoFacturaSRI);
router.get("/facturacion/secuencial/:emisorId/:puntoEmision", obtenerSecuencial);

export default router;
