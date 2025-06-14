import { Router } from "express";
import {    
    getBill, 
    getInvoices, 
    getLastInvoiceNumber,
    createInvoice,
    updateInvoiceStatus,
    getInvoiceStatus,
    getInvoiceStatusBySRI,
    testSRIConnection
} from "./../controllers/invoices.controllers.js";

const router = Router();

// Consultas
router.get("/bill", getInvoices);
router.get("/bill/:id", getBill);
router.get("/bill/:id/estado", getInvoiceStatus);
router.get("/bill/last-number/:emisorId/:puntoEmision", getLastInvoiceNumber);

// Consultas SRI
router.get("/bill/sri-status/:clave_acceso", getInvoiceStatusBySRI);
router.get("/sri/test-connection", testSRIConnection);

// Operaciones
router.post("/bill", createInvoice);
router.put("/bill/:id/status", updateInvoiceStatus);

// Rutas alternativas para compatibilidad con el frontend
router.get("/facturas/:id/estado", getInvoiceStatus);
router.get("/facturas/sri-status/:clave_acceso", getInvoiceStatusBySRI);

export default router;
