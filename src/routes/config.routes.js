import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import { 
  getAllConfigurations, 
  getConfigurationByKey, 
  createConfiguration, 
  updateConfiguration, 
  deleteConfiguration,
  getAllSriConfigurations,
  getActiveConfigurationSri,
  createSriConfiguration,
  updateSriConfiguration,
  deleteSriConfiguration,
  getStorageConfiguration,
  testStorageConnection,
  getStorageStats,
  cleanupOrphanedFiles,
  setSriEnvironment,
  getSystemInfo
} from '../controllers/config.controllers.js';

const router = Router();

// Rutas de configuración del sistema
router.get('/sistema', verifyToken, getAllConfigurations);
router.get('/sistema/:clave', verifyToken, getConfigurationByKey);
router.post('/sistema', verifyToken, createConfiguration);
router.put('/sistema/:id_configuracion', verifyToken, updateConfiguration);
router.delete('/sistema/:id_configuracion', verifyToken, deleteConfiguration);

// Rutas de configuración del SRI
router.get('/sri', verifyToken, getAllSriConfigurations);
router.get('/sri/active', verifyToken, getActiveConfigurationSri);
router.post('/sri', verifyToken, createSriConfiguration);
router.put('/sri/:id_configuracion', verifyToken, updateSriConfiguration);
router.delete('/sri/:id_configuracion', verifyToken, deleteSriConfiguration);
router.post('/sri/environment', verifyToken, setSriEnvironment);

// Rutas de configuración de Storage
router.get('/storage', verifyToken, getStorageConfiguration);
router.get('/storage/test', verifyToken, testStorageConnection);
router.get('/storage/stats', verifyToken, getStorageStats);
router.post('/storage/cleanup', verifyToken, cleanupOrphanedFiles);

// Información general del sistema
router.get('/system/info', verifyToken, getSystemInfo);

export default router;
