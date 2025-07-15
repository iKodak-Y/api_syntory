import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import config from '../config.js';

/**
 * Storage service para manejar archivos en Supabase Storage
 */
export class StorageService {  constructor() {
    try {
      // Usar la clave de servicio si está disponible, de lo contrario usar la clave anónima
      const serviceKey = process.env.SUPABASE_SERVICE_KEY;
      const key = serviceKey || config.supabase.key;
      
      if (!config.supabase.url || !key) {
        console.error('Error: Supabase URL or key is missing');
        console.error('URL:', config.supabase.url);
        console.error('Key available:', key ? 'Yes' : 'No');
        console.error('Service key available:', serviceKey ? 'Yes' : 'No');
      }
      
      console.log('Inicializando Supabase con key role:', 
        key.includes('service_role') ? 'service_role' : 'anon');
      
      this.supabase = createClient(
        config.supabase.url, 
        key
      );
      
      // Buckets disponibles
      this.buckets = config.supabase.storage.buckets;
      console.log('StorageService inicializado correctamente');
    } catch (error) {
      console.error('Error al inicializar StorageService:', error);
      throw error;
    }
  }

  /**
   * Inicializa el cliente de Supabase
   * @returns {Object} - Cliente de Supabase
   */
  getSupabaseClient() {
    return this.supabase;
  }

  /**
   * Sube un archivo a Supabase Storage
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} bucketName - Nombre del bucket (facturas, firmas, img)
   * @param {string} fileName - Nombre del archivo (opcional, si no se proporciona se genera uno)
   * @param {string} contentType - Tipo de contenido del archivo
   * @param {string} folder - Carpeta dentro del bucket (opcional)
   * @returns {Promise<{path: string, url: string}>} - Path y URL del archivo subido
   */  async uploadFile(fileBuffer, bucketName, fileName = null, contentType = 'application/octet-stream', folder = '') {
    try {
      if (!this.supabase) {
        throw new Error('No se ha inicializado el cliente de Supabase');
      }
      
      // Asegurarse de que el bucket existe
      await this.ensureBucketExists(bucketName);
      
      // Si no se proporciona un nombre de archivo, generar uno único
      if (!fileName) {
        const fileExt = this.getExtensionFromContentType(contentType);
        fileName = `${uuidv4()}${fileExt}`;
      }
      
      // Asegurarse de que el nombre del archivo es seguro y único
      const safeFileName = this.getSafeFileName(fileName);
        // Si se proporciona una carpeta, agregarla a la ruta
      const filePath = folder 
        ? `${folder}/${safeFileName}` 
        : safeFileName;
      
      // Subir el archivo al bucket
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, fileBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: true // Permitir sobrescribir archivos con el mismo nombre
        });

      if (error) throw error;

      // Obtener la URL del archivo con fallback
      const fileUrl = await this.getFileUrlWithFallback(bucketName, filePath);
      console.log('URL generada para archivo:', fileUrl);

      return {
        bucket: bucketName,
        path: filePath,
        url: fileUrl
      };
    } catch (error) {
      console.error('Error al subir archivo a Supabase Storage:', error);
      throw error;
    }
  }
  
  /**
   * Sube un archivo desde el sistema de archivos a Supabase Storage
   * @param {string} filePath - Ruta local del archivo
   * @param {string} bucketName - Nombre del bucket
   * @param {string} contentType - Tipo de contenido del archivo
   * @param {string} folder - Carpeta dentro del bucket (opcional)
   * @returns {Promise<{path: string, url: string}>}
   */
  async uploadFileFromPath(filePath, bucketName, contentType = null, folder = '') {
    try {
      // Leer el archivo
      const fileBuffer = await fs.readFile(filePath);
      
      // Determinar el nombre del archivo
      const fileName = path.basename(filePath);
      
      // Si no se proporcionó un tipo de contenido, intentar determinarlo por la extensión
      if (!contentType) {
        const ext = path.extname(fileName).toLowerCase();
        contentType = this.getContentTypeFromExtension(ext);
      }
      
      // Subir el archivo
      return await this.uploadFile(fileBuffer, bucketName, fileName, contentType, folder);
    } catch (error) {
      console.error('Error al subir archivo desde ruta local:', error);
      throw error;
    }
  }

  /**
   * Genera un nombre de archivo seguro y único
   * @param {string} fileName - Nombre original del archivo
   * @returns {string} - Nombre seguro y único
   */
  getSafeFileName(fileName) {
    // Obtener extensión del archivo
    const ext = path.extname(fileName);
    // Generar nombre base único
    const baseName = fileName.replace(ext, '').replace(/[^a-zA-Z0-9]/g, '_');
    // Retornar nombre seguro con timestamp para mayor unicidad
    const timestamp = Date.now();
    return `${baseName}_${timestamp}${ext}`;
  }
  /**
   * Obtiene la extensión de archivo basada en el tipo de contenido
   * @param {string} contentType - Tipo de contenido MIME
   * @returns {string} - Extensión de archivo incluyendo el punto
   */
  getExtensionFromContentType(contentType) {
    const mimeToExt = {
      'application/pdf': '.pdf',
      'text/xml': '.xml',
      'application/xml': '.xml',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'application/pkcs12': '.p12',
      'application/x-pkcs12': '.p12',
      'image/svg+xml': '.svg',
    };

    return mimeToExt[contentType] || '';
  }
  
  /**
   * Obtiene el tipo de contenido basado en la extensión del archivo
   * @param {string} extension - Extensión del archivo
   * @returns {string} - Tipo de contenido MIME
   */
  getContentTypeFromExtension(extension) {
    const extToMime = {
      '.pdf': 'application/pdf',
      '.xml': 'application/xml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.p12': 'application/pkcs12',
      '.svg': 'image/svg+xml',
    };

    return extToMime[extension.toLowerCase()] || 'application/octet-stream';
  }
  /**
   * Elimina un archivo de Supabase Storage
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @returns {Promise<boolean>} - true si se eliminó correctamente
   */
  async deleteFile(bucketName, filePath) {
    try {
      const { error } = await this.supabase.storage
        .from(bucketName)
        .remove([filePath]);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error al eliminar archivo de Supabase Storage:', error);
      throw error;
    }
  }

  /**
   * Obtiene la URL pública de un archivo
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @returns {Promise<string>} - URL pública
   */
  async getFileUrl(bucketName, filePath) {
    try {
      const { data: { publicUrl } } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Error al obtener URL de Supabase Storage:', error);
      throw error;
    }
  }
  
  /**
   * Descarga un archivo de Supabase Storage
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @returns {Promise<ArrayBuffer>} - Contenido del archivo
   */
  async downloadFile(bucketName, filePath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .download(filePath);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al descargar archivo de Supabase Storage:', error);
      throw error;
    }
  }
  
  /**
   * Actualiza un archivo en Supabase Storage
   * @param {Buffer} fileBuffer - Buffer del archivo
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @param {string} contentType - Tipo de contenido del archivo
   * @returns {Promise<{path: string, url: string}>} - Path y URL del archivo actualizado
   */
  async updateFile(fileBuffer, bucketName, filePath, contentType = 'application/octet-stream') {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .update(filePath, fileBuffer, {
          contentType,
          cacheControl: '3600',
          upsert: true // Sobrescribir si existe
        });

      if (error) throw error;

      const { data: { publicUrl } } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      return {
        bucket: bucketName,
        path: filePath,
        url: publicUrl
      };
    } catch (error) {
      console.error('Error al actualizar archivo en Supabase Storage:', error);
      throw error;
    }
  }
  
  /**
   * Lista archivos en un bucket
   * @param {string} bucketName - Nombre del bucket
   * @param {string} folder - Carpeta dentro del bucket (opcional)
   * @returns {Promise<Array>} - Lista de archivos
   */
  async listFiles(bucketName, folder = '') {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .list(folder);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error al listar archivos en Supabase Storage:', error);
      throw error;
    }
  }
    /**
   * Función específica para subir un archivo de certificado (.p12)
   * @param {Buffer|string} fileData - Buffer o ruta del archivo
   * @param {string} fileName - Nombre del archivo (opcional)
   * @returns {Promise<{path: string, url: string}>}
   */
  async uploadCertificate(fileData, fileName = null) {
    try {
      let fileBuffer;
      
      // Si fileData es una cadena, asumimos que es una ruta de archivo
      if (typeof fileData === 'string') {
        fileBuffer = await fs.readFile(fileData);
        if (!fileName) {
          fileName = path.basename(fileData);
        }
      } else {
        // Si no, asumimos que es un buffer
        fileBuffer = fileData;
      }
      
      return await this.uploadFile(
        fileBuffer,
        this.buckets.firmas,
        fileName,
        'application/pkcs12',
        config.supabase.storage.folders.certificados // Usar la subcarpeta de certificados
      );
    } catch (error) {
      console.error('Error al subir certificado:', error);
      throw error;
    }
  }
  
  /**
   * Función específica para subir un archivo XML
   * @param {Buffer|string} fileData - Buffer o ruta del archivo
   * @param {string} fileName - Nombre del archivo (opcional)
   * @param {string} folder - Subcarpeta para organizar XMLs (opcional)
   * @returns {Promise<{path: string, url: string}>}
   */
  async uploadXml(fileData, fileName = null, folder = 'autorizados') {
    try {
      let fileBuffer;
      
      if (typeof fileData === 'string') {
        fileBuffer = await fs.readFile(fileData);
        if (!fileName) {
          fileName = path.basename(fileData);
        }
      } else {
        fileBuffer = fileData;
      }
      
      return await this.uploadFile(
        fileBuffer,
        this.buckets.facturas,
        fileName,
        'application/xml',
        `facturas/${folder}` // Subcarpeta para XMLs
      );
    } catch (error) {
      console.error('Error al subir XML:', error);
      throw error;
    }
  }
  
  /**
   * Función específica para subir un archivo PDF
   * @param {Buffer|string} fileData - Buffer o ruta del archivo
   * @param {string} fileName - Nombre del archivo (opcional)
   * @returns {Promise<{path: string, url: string}>}
   */
  async uploadPdf(fileData, fileName = null) {
    try {
      let fileBuffer;
      
      if (typeof fileData === 'string') {
        fileBuffer = await fs.readFile(fileData);
        if (!fileName) {
          fileName = path.basename(fileData);
        }
      } else {
        fileBuffer = fileData;
      }
      
      return await this.uploadFile(
        fileBuffer,
        this.buckets.facturas,
        fileName,
        'application/pdf',
        'facturas/pdf' // Subcarpeta para PDFs
      );
    } catch (error) {
      console.error('Error al subir PDF:', error);
      throw error;
    }
  }
  
  /**
   * Sube una imagen a Supabase Storage
   * @param {Buffer|string} fileData - Buffer o ruta de la imagen
   * @param {string} fileName - Nombre del archivo (opcional)
   * @param {string} contentType - Tipo de contenido (opcional)
   * @returns {Promise<{path: string, url: string}>} - Path y URL de la imagen subida
   */
  async uploadImage(fileData, fileName = null, contentType = null) {
    try {
      let fileBuffer;
      
      if (typeof fileData === 'string') {
        fileBuffer = await fs.readFile(fileData);
        if (!fileName) {
          fileName = path.basename(fileData);
        }
        if (!contentType) {
          const ext = path.extname(fileName).toLowerCase();
          contentType = this.getContentTypeFromExtension(ext);
        }
      } else {
        fileBuffer = fileData;
        if (!contentType) {
          contentType = 'image/png';
        }
      }
      
      return await this.uploadFile(
        fileBuffer,
        this.buckets.img,
        fileName,
        contentType,
        config.supabase.storage.folders.logos // Usar la subcarpeta de logos
      );
    } catch (error) {
      console.error('Error al subir imagen:', error);
      throw error;
    }
  }

  /**
   * Verifica si un bucket existe y lo crea si no existe
   * @param {string} bucketName - Nombre del bucket
   * @returns {Promise<boolean>} - true si el bucket existe o se creó correctamente
   */
  async ensureBucketExists(bucketName) {
    try {
      // Verificar si el bucket existe
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) throw listError;
      
      const bucketExists = buckets.some(bucket => bucket.name === bucketName);
      
      if (!bucketExists) {
        console.log(`El bucket ${bucketName} no existe. Creándolo...`);
        const { data, error } = await this.supabase.storage.createBucket(bucketName, {
          public: true // Hacer el bucket público por defecto
        });
        
        if (error) throw error;
        console.log(`Bucket ${bucketName} creado correctamente`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error al verificar/crear bucket ${bucketName}:`, error);
      return false;
    }
  }

  /**
   * Obtiene la URL pública de un archivo, con fallback a URL firmada
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @returns {Promise<string>} - URL pública o firmada
   */
  async getFileUrlWithFallback(bucketName, filePath) {
    try {
      // Intentar primero con URL pública
      const { data: { publicUrl } } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      console.log('URL pública generada:', publicUrl);

      // Verificar si el bucket es público probando la URL
      try {
        const response = await fetch(publicUrl, { method: 'HEAD' });
        if (response.ok) {
          return publicUrl;
        } else {
          console.log('URL pública no accesible, intentando URL firmada...');
        }
      } catch (fetchError) {
        console.log('Error al verificar URL pública:', fetchError.message);
      }

      // Si la URL pública no funciona, generar URL firmada
      const { data: signedData, error: signedError } = await this.supabase.storage
        .from(bucketName)
        .createSignedUrl(filePath, 3600 * 24 * 7); // 7 días

      if (signedError) {
        console.error('Error al crear URL firmada:', signedError);
        return publicUrl; // Devolver la pública como fallback
      }

      console.log('URL firmada generada:', signedData.signedUrl);
      return signedData.signedUrl;

    } catch (error) {
      console.error('Error al obtener URL de archivo:', error);
      throw error;
    }
  }

  /**
   * Verifica si un archivo existe en Supabase Storage
   * @param {string} bucketName - Nombre del bucket
   * @param {string} filePath - Ruta del archivo en el bucket
   * @returns {Promise<boolean>} - true si el archivo existe
   */  async fileExists(bucketName, filePath) {
    try {
      const { data, error } = await this.supabase.storage
        .from(bucketName)
        .download(filePath);

      // Si no hay error y tenemos data, el archivo existe
      return !error && data && data.size > 0;
    } catch (error) {
      // Si hay error, el archivo no existe
      return false;
    }
  }
}

export default new StorageService();
