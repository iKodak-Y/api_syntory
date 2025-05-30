import { Router } from 'express';
import { getMenu, getMenus } from './../controllers/menu.controllers.js';

const router = Router();

router.get("/menu", getMenus);
router.get("/menu/:id", getMenu);

export default router;