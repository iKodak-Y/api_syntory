import { Router } from "express";
import { getBill, getInvoices, getLastInvoiceNumber } from "./../controllers/invoices.controllers.js";

const router = Router();

router.get("/bill", getInvoices);
router.get("/bill/:id", getBill);
router.get("/bill/last-number/:emisorId/:puntoEmision", getLastInvoiceNumber    );

export default router;
