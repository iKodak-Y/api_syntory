import { Router } from 'express';
import { getBill, getInvoices } from './../controllers/invoices.controllers.js';

const router = Router();

router.get("/bill", getInvoices);
router.get("/bill/:id", getBill);

export default router;