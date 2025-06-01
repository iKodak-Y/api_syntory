import { Router } from "express";
import { 
    getBill, 
    getInvoices, 
    getLastInvoiceNumber,
    createInvoice,
    updateInvoiceStatus,
    voidInvoice
} from "./../controllers/invoices.controllers.js";

const router = Router();

// Consultas
router.get("/bill", getInvoices);
router.get("/bill/:id", getBill);
router.get("/bill/last-number/:emisorId/:puntoEmision", getLastInvoiceNumber);

// Operaciones
router.post("/bill", createInvoice);
router.put("/bill/:id/status", updateInvoiceStatus);
router.put("/bill/:id/void", voidInvoice);

export default router;
