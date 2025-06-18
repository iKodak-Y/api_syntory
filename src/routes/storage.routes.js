import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import multer from 'multer';
import { 
  uploadFile, 
  getFileUrl, 
  deleteFile, 
  listFiles 
} from '../controllers/storage.controllers.js';

const router = Router();

// Configuración de multer para manejar archivos
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

// Rutas de almacenamiento de archivos
router.post('/upload', verifyToken, upload.single('file'), uploadFile);
router.get('/url/:bucket/:path', verifyToken, getFileUrl);
router.delete('/:bucket/:path', verifyToken, deleteFile);
router.get('/list/:bucket', verifyToken, listFiles);
router.get('/list/:bucket/:folder', verifyToken, listFiles);

export default router;
