import storageService from '../services/storage.service.js';
import { pool } from '../database/connection.js';

export const uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ningún archivo' });
    }

    const { bucket, folder } = req.body;
    const file = req.file;
    
    let result;
    
    // Determinar el tipo de archivo y enviar al servicio correspondiente
    const fileType = file.mimetype.split('/')[0];
    const ext = file.originalname.split('.').pop().toLowerCase();
    
    if (ext === 'p12') {
      // Subir certificado
      result = await storageService.uploadCertificate(file.buffer, file.originalname);
    } else if (ext === 'xml') {
      // Subir XML
      result = await storageService.uploadXml(file.buffer, file.originalname, folder || 'autorizados');
    } else if (ext === 'pdf') {
      // Subir PDF
      result = await storageService.uploadPdf(file.buffer, file.originalname);
    } else if (fileType === 'image') {
      // Subir imagen
      result = await storageService.uploadImage(file.buffer, file.originalname, file.mimetype);
    } else {
      // Subida genérica
      result = await storageService.uploadFile(file.buffer, bucket || 'facturas', file.originalname, file.mimetype, folder || '');
    }

    res.json({
      message: 'Archivo subido correctamente',
      file: result
    });
  } catch (error) {
    console.error('Error al subir archivo:', error);
    res.status(500).json({ message: 'Error al subir archivo', error: error.message });
  }
};

export const getFileUrl = async (req, res) => {
  try {
    // En lugar de usar path directamente, usamos req.originalUrl para obtener la ruta completa
    const { bucket } = req.params;
    let path = req.params.path;
    
    // Si hay query params, anexarlos a la URL
    if (Object.keys(req.query).length > 0) {
      const queryParams = new URLSearchParams(req.query);
      path += `?${queryParams.toString()}`;
    }
    
    if (!bucket || !path) {
      return res.status(400).json({ message: 'Se requieren los parámetros bucket y path' });
    }
    
    const url = await storageService.getFileUrl(bucket, path);
    
    res.json({
      url
    });
  } catch (error) {
    console.error('Error al obtener URL de archivo:', error);
    res.status(500).json({ message: 'Error al obtener URL de archivo', error: error.message });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const { bucket } = req.params;
    let path = req.params.path;
    
    // Si hay query params, anexarlos a la URL
    if (Object.keys(req.query).length > 0) {
      const queryParams = new URLSearchParams(req.query);
      path += `?${queryParams.toString()}`;
    }
    
    if (!bucket || !path) {
      return res.status(400).json({ message: 'Se requieren los parámetros bucket y path' });
    }
    
    await storageService.deleteFile(bucket, path);
    
    res.json({
      message: 'Archivo eliminado correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar archivo:', error);
    res.status(500).json({ message: 'Error al eliminar archivo', error: error.message });
  }
};

export const listFiles = async (req, res) => {
  try {
    const { bucket, folder } = req.params;
    
    if (!bucket) {
      return res.status(400).json({ message: 'Se requiere el parámetro bucket' });
    }
    
    // Si folder no está definido, usar string vacío
    const folderPath = folder || '';
    
    const files = await storageService.listFiles(bucket, folderPath);
    
    res.json({
      files
    });
  } catch (error) {
    console.error('Error al listar archivos:', error);
    res.status(500).json({ message: 'Error al listar archivos', error: error.message });
  }
};
