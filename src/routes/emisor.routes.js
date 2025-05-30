import { Router } from 'express';
import { getEmisor, getEmisores } from './../controllers/emisor.controllers.js';

const router = Router();

router.get("/emisor", getEmisores);
router.get("/emisor/:id", getEmisor);

export default router;