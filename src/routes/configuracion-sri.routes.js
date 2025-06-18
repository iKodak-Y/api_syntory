import { Router } from 'express';
import { 
  getConfiguracionSRI, 
  getConfiguracionSRIById, 
  createConfiguracionSRI, 
  updateConfiguracionSRI, 
  deleteConfiguracionSRI 
} from '../controllers/configuracion-sri.controllers.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Rutas públicas
router.get("/configuracion-sri", getConfiguracionSRI);
router.get("/configuracion-sri/:id", getConfiguracionSRIById);

// Rutas protegidas
router.post("/configuracion-sri", verifyToken, isAdmin, createConfiguracionSRI);
router.put("/configuracion-sri/:id", verifyToken, isAdmin, updateConfiguracionSRI);
router.delete("/configuracion-sri/:id", verifyToken, isAdmin, deleteConfiguracionSRI);

export default router;
