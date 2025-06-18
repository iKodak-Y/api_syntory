import storageService from '../services/storage.service.js';
import { pool } from '../database/connection.js';

/**
 * Obtener información de todos los buckets configurados
 */
export const getBucketsInfo = async (req, res) => {
  try {
    const bucketsInfo = {};
    
    for (const [bucketName, bucketKey] of Object.entries(storageService.buckets)) {
      try {
        const files = await storageService.listFiles(bucketKey);
        
        // Obtener información detallada de archivos
        const filesByFolder = {};
        let totalSize = 0;
        
        files.forEach(file => {
          const folder = file.name.includes('/') ? file.name.split('/')[0] : 'root';
          if (!filesByFolder[folder]) {
            filesByFolder[folder] = [];
          }
          filesByFolder[folder].push({
            name: file.name,
            size: file.metadata?.size || 0,
            lastModified: file.updated_at,
            contentType: file.metadata?.mimetype
          });
          totalSize += file.metadata?.size || 0;
        });
        
        bucketsInfo[bucketName] = {
          bucket_key: bucketKey,
          total_files: files.length,
          total_size: totalSize,
          folders: filesByFolder,
          status: 'available'
        };
      } catch (error) {
        bucketsInfo[bucketName] = {
          bucket_key: bucketKey,
          error: error.message,
          status: 'error'
        };
      }
    }
    
    res.json({
      buckets: bucketsInfo,
      total_buckets: Object.keys(storageService.buckets).length,
      service_status: 'active'
    });
  } catch (error) {
    console.error('Error al obtener información de buckets:', error);
    res.status(500).json({ 
      message: 'Error al obtener información de buckets', 
      error: error.message 
    });
  }
};

/**
 * Obtener archivos de un bucket específico
 */
export const getBucketFiles = async (req, res) => {
  try {
    const { bucketType, folder } = req.params;
    
    if (!storageService.buckets[bucketType]) {
      return res.status(400).json({
        message: `Tipo de bucket no válido. Tipos disponibles: ${Object.keys(storageService.buckets).join(', ')}`
      });
    }
    
    const bucketKey = storageService.buckets[bucketType];
    const folderPath = folder || '';
    
    const files = await storageService.listFiles(bucketKey, folderPath);
    
    // Enriquecer información de archivos
    const enrichedFiles = files.map(file => ({
      name: file.name,
      size: file.metadata?.size || 0,
      lastModified: file.updated_at,
      contentType: file.metadata?.mimetype,
      isDirectory: !file.metadata,
      url: `${storageService.supabase.storage.from(bucketKey).getPublicUrl(file.name).data.publicUrl}`
    }));
    
    res.json({
      bucket_type: bucketType,
      bucket_key: bucketKey,
      folder: folderPath,
      files: enrichedFiles,
      total_files: enrichedFiles.length
    });
  } catch (error) {
    console.error('Error al obtener archivos del bucket:', error);
    res.status(500).json({ 
      message: 'Error al obtener archivos del bucket', 
      error: error.message 
    });
  }
};

/**
 * Eliminar archivos huérfanos (sin referencia en la base de datos)
 */
export const deleteOrphanedFiles = async (req, res) => {
  try {
    const { bucketType, confirm } = req.body;
    
    if (!confirm) {
      return res.status(400).json({
        message: 'Debe confirmar la eliminación con confirm: true'
      });
    }
    
    const results = {
      deleted: [],
      errors: [],
      summary: {}
    };
    
    // Procesar según el tipo de bucket
    if (bucketType === 'firmas' || bucketType === 'all') {
      // Obtener certificados en uso
      const { rows: certificados } = await pool.query(`
        SELECT DISTINCT certificado_path 
        FROM emisor 
        WHERE certificado_path IS NOT NULL AND certificado_path != ''
      `);
      
      const usedCertPaths = certificados.map(c => c.certificado_path);
      
      try {
        const firmFiles = await storageService.listFiles(storageService.buckets.firmas);
        
        for (const file of firmFiles) {
          if (!usedCertPaths.includes(file.name)) {
            try {
              await storageService.deleteFile(storageService.buckets.firmas, file.name);
              results.deleted.push({
                type: 'certificado',
                file: file.name,
                bucket: storageService.buckets.firmas
              });
            } catch (deleteError) {
              results.errors.push({
                type: 'certificado',
                file: file.name,
                error: deleteError.message
              });
            }
          }
        }
      } catch (error) {
        results.errors.push({
          type: 'certificados_scan',
          error: error.message
        });
      }
    }
    
    if (bucketType === 'img' || bucketType === 'all') {
      // Obtener logos en uso
      const { rows: logos } = await pool.query(`
        SELECT DISTINCT logo 
        FROM emisor 
        WHERE logo IS NOT NULL AND logo != ''
      `);
      
      const usedLogoPaths = logos.map(l => l.logo);
      
      try {
        const imgFiles = await storageService.listFiles(storageService.buckets.img);
        
        for (const file of imgFiles) {
          if (!usedLogoPaths.includes(file.name)) {
            try {
              await storageService.deleteFile(storageService.buckets.img, file.name);
              results.deleted.push({
                type: 'logo',
                file: file.name,
                bucket: storageService.buckets.img
              });
            } catch (deleteError) {
              results.errors.push({
                type: 'logo',
                file: file.name,
                error: deleteError.message
              });
            }
          }
        }
      } catch (error) {
        results.errors.push({
          type: 'logos_scan',
          error: error.message
        });
      }
    }
    
    results.summary = {
      total_deleted: results.deleted.length,
      total_errors: results.errors.length,
      buckets_processed: bucketType === 'all' ? 'todos' : bucketType
    };
    
    res.json({
      message: 'Proceso de limpieza completado',
      results
    });
  } catch (error) {
    console.error('Error al eliminar archivos huérfanos:', error);
    res.status(500).json({ 
      message: 'Error al eliminar archivos huérfanos', 
      error: error.message 
    });
  }
};

/**
 * Sincronizar archivos con la base de datos
 */
export const syncFilesWithDatabase = async (req, res) => {
  try {
    const results = {
      missing_files: [],
      invalid_references: [],
      summary: {}
    };
    
    // Verificar certificados
    const { rows: emisores } = await pool.query(`
      SELECT id_emisor, ruc, certificado_path 
      FROM emisor 
      WHERE certificado_path IS NOT NULL AND certificado_path != ''
    `);
    
    for (const emisor of emisores) {
      try {
        // Intentar obtener la URL del archivo para verificar que existe
        await storageService.getFileUrl(storageService.buckets.firmas, emisor.certificado_path);
      } catch (error) {
        results.invalid_references.push({
          type: 'certificado',
          emisor_id: emisor.id_emisor,
          ruc: emisor.ruc,
          path: emisor.certificado_path,
          error: error.message
        });
      }
    }
    
    // Verificar logos
    const { rows: emisoresConLogo } = await pool.query(`
      SELECT id_emisor, ruc, logo 
      FROM emisor 
      WHERE logo IS NOT NULL AND logo != ''
    `);
    
    for (const emisor of emisoresConLogo) {
      try {
        if (emisor.logo.startsWith('img/')) {
          await storageService.getFileUrl(storageService.buckets.img, emisor.logo);
        }
      } catch (error) {
        results.invalid_references.push({
          type: 'logo',
          emisor_id: emisor.id_emisor,
          ruc: emisor.ruc,
          path: emisor.logo,
          error: error.message
        });
      }
    }
    
    results.summary = {
      total_missing: results.missing_files.length,
      total_invalid: results.invalid_references.length,
      certificados_verificados: emisores.length,
      logos_verificados: emisoresConLogo.length
    };
    
    res.json({
      message: 'Sincronización completada',
      results
    });
  } catch (error) {
    console.error('Error al sincronizar archivos:', error);
    res.status(500).json({ 
      message: 'Error al sincronizar archivos', 
      error: error.message 
    });
  }
};

/**
 * Obtener estadísticas de uso de storage
 */
export const getStorageUsage = async (req, res) => {
  try {
    const usage = {
      by_bucket: {},
      by_type: {
        certificates: 0,
        logos: 0,
        invoices: 0,
        pdfs: 0,
        xml_files: 0
      },
      total_files: 0,
      total_size: 0
    };
    
    // Analizar cada bucket
    for (const [bucketName, bucketKey] of Object.entries(storageService.buckets)) {
      try {
        const files = await storageService.listFiles(bucketKey);
        
        let bucketSize = 0;
        let fileTypes = {};
        
        files.forEach(file => {
          const size = file.metadata?.size || 0;
          bucketSize += size;
          
          const ext = file.name.split('.').pop()?.toLowerCase();
          if (!fileTypes[ext]) fileTypes[ext] = 0;
          fileTypes[ext]++;
          
          // Categorizar por tipo
          if (ext === 'p12') usage.by_type.certificates++;
          else if (['png', 'jpg', 'jpeg', 'svg'].includes(ext)) usage.by_type.logos++;
          else if (ext === 'xml') usage.by_type.xml_files++;
          else if (ext === 'pdf') usage.by_type.pdfs++;
        });
        
        usage.by_bucket[bucketName] = {
          bucket_key: bucketKey,
          total_files: files.length,
          total_size: bucketSize,
          file_types: fileTypes
        };
        
        usage.total_files += files.length;
        usage.total_size += bucketSize;
      } catch (error) {
        usage.by_bucket[bucketName] = {
          error: error.message
        };
      }
    }
    
    // Convertir tamaños a formato legible
    const formatSize = (bytes) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };
    
    usage.total_size_formatted = formatSize(usage.total_size);
    
    // Agregar información de la base de datos
    const { rows: dbStats } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM emisor WHERE certificado_path IS NOT NULL AND certificado_path != '') as certificados_db,
        (SELECT COUNT(*) FROM emisor WHERE logo IS NOT NULL AND logo != '') as logos_db,
        (SELECT COUNT(*) FROM factura_electronica) as facturas_db
    `);
    
    usage.database_references = dbStats[0];
    
    res.json({
      message: 'Estadísticas de uso obtenidas',
      usage,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de uso:', error);
    res.status(500).json({ 
      message: 'Error al obtener estadísticas de uso', 
      error: error.message 
    });
  }
};
