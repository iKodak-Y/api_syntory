import { Router } from "express";
import {
  testCompleteInvoicing,
  listCertificates,
  verifyConfiguration
} from "../controllers/facturacion-test.controllers.js";
import { authenticateToken, isAdmin } from "../middlewares/auth.middleware.js";

const router = Router();

// Rutas para pruebas de facturación electrónica
// Estas rutas están diseñadas para probar el flujo completo de facturación electrónica

/**
 * GET /api/facturacion-test/complete
 * Prueba el flujo completo de facturación electrónica:
 * - Obtiene configuración SRI
 * - Obtiene datos del emisor
 * - Accede al certificado digital desde Supabase Storage
 * - Genera y firma el XML
 * - Envía al SRI
 * - Procesa la respuesta
 */
router.get("/facturacion-test/complete", authenticateToken, testCompleteInvoicing);

/**
 * GET /api/facturacion-test/certificates
 * Lista los certificados disponibles en Supabase Storage
 */
router.get("/facturacion-test/certificates", authenticateToken, listCertificates);

/**
 * GET /api/facturacion-test/verify-config
 * Verifica la configuración completa para facturación electrónica:
 * - Configuración SRI
 * - Datos del emisor
 * - Acceso a Supabase Storage
 * - Disponibilidad de certificados
 */
router.get("/facturacion-test/verify-config", authenticateToken, verifyConfiguration);

export default router;
