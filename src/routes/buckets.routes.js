import { Router } from 'express';
import { verifyToken } from '../middlewares/auth.middleware.js';
import {
  getBucketsInfo,
  getBucketFiles,
  deleteOrphanedFiles,
  syncFilesWithDatabase,
  getStorageUsage
} from '../controllers/buckets.controllers.js';

const router = Router();

// Rutas para gestión de buckets
router.get('/info', verifyToken, getBucketsInfo);
router.get('/:bucketType/files', verifyToken, getBucketFiles);
router.get('/:bucketType/files/:folder', verifyToken, getBucketFiles);
router.get('/usage', verifyToken, getStorageUsage);

// Operaciones de mantenimiento
router.post('/cleanup', verifyToken, deleteOrphanedFiles);
router.post('/sync', verifyToken, syncFilesWithDatabase);

export default router;
