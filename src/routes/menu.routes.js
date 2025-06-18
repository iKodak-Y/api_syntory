import { Router } from 'express';
import { 
  getMenu, 
  getMenus, 
  getMenusByRol, 
  getAccesosByRol, 
  assignPermissions,
  deleteRoleAccesos,
  createAcceso
} from './../controllers/menu.controllers.js';

const router = Router();

router.get("/menu", getMenus);
router.get("/menu/:id", getMenu);
router.get("/menu/rol/:id_rol", getMenusByRol);
router.get("/accesos/rol/:id_rol", getAccesosByRol);
router.post("/accesos/rol/:id_rol", assignPermissions);
router.delete("/accesos/rol/:id_rol", deleteRoleAccesos);
router.post("/accesos", createAcceso);

export default router;