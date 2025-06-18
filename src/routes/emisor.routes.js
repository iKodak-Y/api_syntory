import { Router } from 'express';
import { 
  getEmisor, 
  getEmisores, 
  getPrimerEmisor, 
  updateEmisor, 
  createEmisor,
  updateCertificado,
  updateLogo,
  checkStorageConfig
} from './../controllers/emisor.controllers.js';
import { verifyToken } from '../middlewares/auth.middleware.js';
import multer from 'multer';

// Configuración de multer para manejar archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

const router = Router();

// Rutas sin autenticación
router.get("/emisores", getEmisores);
router.get("/emisor", getPrimerEmisor);
router.get("/emisor/:id", getEmisor);

// Ruta de diagnóstico (temporal)
router.get("/check-storage", checkStorageConfig);

// Rutas protegidas
router.post("/emisor", verifyToken, createEmisor);
router.put("/emisor/:id", verifyToken, updateEmisor);
router.post("/emisor/:id/certificado", verifyToken, upload.single('certificado'), updateCertificado);
router.post("/emisor/:id/logo", verifyToken, upload.single('logo'), updateLogo);

export default router;