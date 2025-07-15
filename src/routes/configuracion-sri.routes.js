import { Router } from 'express';
import { 
  getConfiguracionSRI, 
  getConfiguracionSRIById, 
  createConfiguracionSRI, 
  updateConfiguracionSRI, 
  deleteConfiguracionSRI,
  getUrlsSRI,
  activarConfiguracionSRI,
  cambiarAmbienteDefecto,
  getAllConfiguracionesSRI
} from '../controllers/configuracion-sri.controllers.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// Rutas públicas
router.get("/configuracion-sri", getConfiguracionSRI);
router.get("/configuracion-sri/all", getAllConfiguracionesSRI);
router.get("/configuracion-sri/urls", getUrlsSRI);
router.get("/configuracion-sri/:id", getConfiguracionSRIById);

// Rutas protegidas
router.post("/configuracion-sri", verifyToken, isAdmin, createConfiguracionSRI);
router.put("/configuracion-sri/:id", verifyToken, isAdmin, updateConfiguracionSRI);
router.put("/configuracion-sri/:id/activar", verifyToken, isAdmin, activarConfiguracionSRI);
router.put("/configuracion-sri/ambiente", verifyToken, isAdmin, cambiarAmbienteDefecto);
router.delete("/configuracion-sri/:id", verifyToken, isAdmin, deleteConfiguracionSRI);

export default router;
