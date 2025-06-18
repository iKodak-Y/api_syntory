import { Router } from 'express';
import { 
    getVentas,
    getVenta,
    createVenta,
    updateVentaEstado,
    anularVenta,
    descargarPDFVenta,
    verPDFVenta,
    generarPDF,
    getVentasResumen,
    getSiguienteSecuencial,
    probarEmail,
    reenviarEmail,
    testPDF
} from '../controllers/ventas.controller.js';

const router = Router();

/**
 * Rutas para el sistema de ventas
 * Patrón REST para mantener consistencia con otros módulos
 */

// Rutas especiales (deben ir antes de las rutas con parámetros)
router.get("/ventas/resumen", getVentasResumen);
router.get("/ventas/siguiente-secuencial/:id_emisor/:punto_emision", getSiguienteSecuencial);
router.get("/ventas/email/test", probarEmail);
router.get("/ventas/pdf/test", testPDF); // Ruta de prueba para PDF

// Rutas para PDFs
router.get("/ventas/:id/pdf",  verPDFVenta);
router.get("/ventas/:id/pdf/download",  descargarPDFVenta);
router.post("/ventas/:id/pdf/generate",  generarPDF);

// Rutas para email
router.post("/ventas/:id/email/reenviar", reenviarEmail);

// Rutas para acciones específicas
router.post("/ventas/:id/cancel",  anularVenta);
router.patch("/ventas/:id/status",  updateVentaEstado);

// Rutas básicas CRUD (en orden REST estándar)
router.get("/ventas",  getVentas);
router.post("/ventas",  createVenta);
router.get("/ventas/:id",  getVenta);

export default router;
