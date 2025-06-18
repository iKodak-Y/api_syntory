import { pool } from '../database/connection.js';
import storageService from '../services/storage.service.js';

export const getAllConfigurations = async (req, res) => {
  try {
    const query = `SELECT id_configuracion, clave, valor, descripcion, fecha_modificacion 
                  FROM configuracion_sistema 
                  ORDER BY id_configuracion`;
    
    const { rows } = await pool.query(query);
    
    res.json({
      configuraciones: rows
    });
  } catch (error) {
    console.error('Error al obtener configuraciones del sistema:', error);
    res.status(500).json({ message: 'Error al obtener configuraciones', error: error.message });
  }
};

export const getConfigurationByKey = async (req, res) => {
  try {
    const { clave } = req.params;
    
    const query = `SELECT id_configuracion, clave, valor, descripcion, fecha_modificacion 
                  FROM configuracion_sistema 
                  WHERE clave = $1`;
    
    const { rows } = await pool.query(query, [clave]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No se encontró configuración con clave: ${clave}` });
    }
    
    res.json({
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener configuración del sistema:', error);
    res.status(500).json({ message: 'Error al obtener configuración', error: error.message });
  }
};

export const createConfiguration = async (req, res) => {
  try {
    const { clave, valor, descripcion } = req.body;
    
    if (!clave || !valor) {
      return res.status(400).json({ message: 'La clave y valor son obligatorios' });
    }
    
    // Verificar si la clave ya existe
    const checkQuery = 'SELECT id_configuracion FROM configuracion_sistema WHERE clave = $1';
    const checkResult = await pool.query(checkQuery, [clave]);
    
    if (checkResult.rows.length > 0) {
      return res.status(400).json({ message: `La clave ${clave} ya está registrada` });
    }
    
    const query = `INSERT INTO configuracion_sistema (clave, valor, descripcion) 
                  VALUES ($1, $2, $3) 
                  RETURNING id_configuracion, clave, valor, descripcion, fecha_modificacion`;
    
    const values = [clave, valor, descripcion || null];
    const { rows } = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Configuración creada correctamente',
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al crear configuración del sistema:', error);
    res.status(500).json({ message: 'Error al crear configuración', error: error.message });
  }
};

export const updateConfiguration = async (req, res) => {
  try {
    const { id_configuracion } = req.params;
    const { valor, descripcion } = req.body;
    
    if (!valor) {
      return res.status(400).json({ message: 'El valor es obligatorio' });
    }
    
    const query = `UPDATE configuracion_sistema 
                  SET valor = $1, descripcion = $2, fecha_modificacion = NOW() 
                  WHERE id_configuracion = $3 
                  RETURNING id_configuracion, clave, valor, descripcion, fecha_modificacion`;
    
    const values = [valor, descripcion || null, id_configuracion];
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No se encontró configuración con ID: ${id_configuracion}` });
    }
    
    res.json({
      message: 'Configuración actualizada correctamente',
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar configuración del sistema:', error);
    res.status(500).json({ message: 'Error al actualizar configuración', error: error.message });
  }
};

export const deleteConfiguration = async (req, res) => {
  try {
    const { id_configuracion } = req.params;
    
    const query = 'DELETE FROM configuracion_sistema WHERE id_configuracion = $1 RETURNING id_configuracion';
    const { rows } = await pool.query(query, [id_configuracion]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No se encontró configuración con ID: ${id_configuracion}` });
    }
    
    res.json({
      message: 'Configuración eliminada correctamente',
      id_configuracion: rows[0].id_configuracion
    });
  } catch (error) {
    console.error('Error al eliminar configuración del sistema:', error);
    res.status(500).json({ message: 'Error al eliminar configuración', error: error.message });
  }
};

// Controladores para configuración SRI
export const getAllSriConfigurations = async (req, res) => {
  try {
    const query = `SELECT id_configuracion, url_pruebas, url_produccion, 
                  fecha_vigencia_inicio, fecha_vigencia_fin, descripcion, fecha_registro 
                  FROM configuracion_sri 
                  ORDER BY id_configuracion DESC`;
    
    const { rows } = await pool.query(query);
    
    res.json({
      configuraciones: rows
    });
  } catch (error) {
    console.error('Error al obtener configuraciones del SRI:', error);
    res.status(500).json({ message: 'Error al obtener configuraciones del SRI', error: error.message });
  }
};

export const getActiveConfigurationSri = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    
    const query = `SELECT id_configuracion, url_pruebas, url_produccion, 
                  fecha_vigencia_inicio, fecha_vigencia_fin, descripcion, fecha_registro 
                  FROM configuracion_sri 
                  WHERE fecha_vigencia_inicio <= $1 
                  AND (fecha_vigencia_fin IS NULL OR fecha_vigencia_fin >= $1) 
                  ORDER BY fecha_vigencia_inicio DESC 
                  LIMIT 1`;
    
    const { rows } = await pool.query(query, [today]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: 'No se encontró ninguna configuración del SRI vigente' });
    }
    
    res.json({
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al obtener configuración activa del SRI:', error);
    res.status(500).json({ message: 'Error al obtener configuración del SRI', error: error.message });
  }
};

export const createSriConfiguration = async (req, res) => {
  try {
    const { url_pruebas, url_produccion, fecha_vigencia_inicio, fecha_vigencia_fin, descripcion } = req.body;
    
    if (!url_pruebas || !url_produccion || !fecha_vigencia_inicio) {
      return res.status(400).json({ 
        message: 'Los campos url_pruebas, url_produccion y fecha_vigencia_inicio son obligatorios' 
      });
    }
    
    const query = `INSERT INTO configuracion_sri 
                  (url_pruebas, url_produccion, fecha_vigencia_inicio, fecha_vigencia_fin, descripcion) 
                  VALUES ($1, $2, $3, $4, $5) 
                  RETURNING id_configuracion, url_pruebas, url_produccion, fecha_vigencia_inicio, 
                  fecha_vigencia_fin, descripcion, fecha_registro`;
    
    const values = [url_pruebas, url_produccion, fecha_vigencia_inicio, fecha_vigencia_fin || null, descripcion || null];
    const { rows } = await pool.query(query, values);
    
    res.status(201).json({
      message: 'Configuración del SRI creada correctamente',
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al crear configuración del SRI:', error);
    res.status(500).json({ message: 'Error al crear configuración del SRI', error: error.message });
  }
};

export const updateSriConfiguration = async (req, res) => {
  try {
    const { id_configuracion } = req.params;
    const { url_pruebas, url_produccion, fecha_vigencia_inicio, fecha_vigencia_fin, descripcion } = req.body;
    
    if (!url_pruebas || !url_produccion || !fecha_vigencia_inicio) {
      return res.status(400).json({ 
        message: 'Los campos url_pruebas, url_produccion y fecha_vigencia_inicio son obligatorios' 
      });
    }
    
    const query = `UPDATE configuracion_sri 
                  SET url_pruebas = $1, url_produccion = $2, fecha_vigencia_inicio = $3, 
                  fecha_vigencia_fin = $4, descripcion = $5 
                  WHERE id_configuracion = $6 
                  RETURNING id_configuracion, url_pruebas, url_produccion, fecha_vigencia_inicio, 
                  fecha_vigencia_fin, descripcion, fecha_registro`;
    
    const values = [
      url_pruebas, 
      url_produccion, 
      fecha_vigencia_inicio, 
      fecha_vigencia_fin || null, 
      descripcion || null,
      id_configuracion
    ];
    
    const { rows } = await pool.query(query, values);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No se encontró configuración con ID: ${id_configuracion}` });
    }
    
    res.json({
      message: 'Configuración del SRI actualizada correctamente',
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al actualizar configuración del SRI:', error);
    res.status(500).json({ message: 'Error al actualizar configuración del SRI', error: error.message });
  }
};

export const deleteSriConfiguration = async (req, res) => {
  try {
    const { id_configuracion } = req.params;
    
    const query = 'DELETE FROM configuracion_sri WHERE id_configuracion = $1 RETURNING id_configuracion';
    const { rows } = await pool.query(query, [id_configuracion]);
    
    if (rows.length === 0) {
      return res.status(404).json({ message: `No se encontró configuración con ID: ${id_configuracion}` });
    }
    
    res.json({
      message: 'Configuración del SRI eliminada correctamente',
      id_configuracion: rows[0].id_configuracion
    });
  } catch (error) {
    console.error('Error al eliminar configuración del SRI:', error);
    res.status(500).json({ message: 'Error al eliminar configuración del SRI', error: error.message });
  }
};

// Nuevas funciones para configuración de Storage
export const getStorageConfiguration = async (req, res) => {
  try {
    // Obtener configuraciones relacionadas con storage
    const query = `SELECT id_configuracion, clave, valor, descripcion, fecha_modificacion 
                  FROM configuracion_sistema 
                  WHERE clave LIKE 'storage_%' OR clave LIKE 'supabase_%'
                  ORDER BY clave`;
    
    const { rows } = await pool.query(query);
    
    // Información de buckets desde el servicio
    const bucketsInfo = storageService.buckets;
    
    res.json({
      configuraciones: rows,
      buckets_disponibles: bucketsInfo,
      cliente_supabase: {
        conectado: !!storageService.supabase,
        url: storageService.supabase ? 'Configurado' : 'No configurado'
      }
    });
  } catch (error) {
    console.error('Error al obtener configuración de storage:', error);
    res.status(500).json({ message: 'Error al obtener configuración de storage', error: error.message });
  }
};

export const testStorageConnection = async (req, res) => {
  try {
    // Probar conexión listando archivos del bucket de facturas
    const files = await storageService.listFiles('facturas', '');
    
    res.json({
      success: true,
      message: 'Conexión a Supabase Storage exitosa',
      buckets_configurados: storageService.buckets,
      archivos_encontrados: files.length
    });
  } catch (error) {
    console.error('Error al probar conexión con storage:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error al conectar con Supabase Storage', 
      error: error.message 
    });
  }
};

export const getStorageStats = async (req, res) => {
  try {
    const stats = {};
    
    // Obtener estadísticas de cada bucket
    for (const [bucketName, bucketKey] of Object.entries(storageService.buckets)) {
      try {
        const files = await storageService.listFiles(bucketKey);
        stats[bucketName] = {
          total_archivos: files.length,
          bucket_name: bucketKey
        };
      } catch (error) {
        stats[bucketName] = {
          error: `Error al acceder al bucket: ${error.message}`,
          bucket_name: bucketKey
        };
      }
    }
    
    res.json({
      estadisticas_storage: stats,
      fecha_consulta: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al obtener estadísticas de storage:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
};

export const cleanupOrphanedFiles = async (req, res) => {
  try {
    const results = {
      certificados_huerfanos: [],
      logos_huerfanos: [],
      facturas_huerfanas: []
    };
    
    // Verificar certificados huérfanos
    const certificadosQuery = `
      SELECT DISTINCT certificado_path 
      FROM emisor 
      WHERE certificado_path IS NOT NULL AND certificado_path != ''
    `;
    const { rows: certificados } = await pool.query(certificadosQuery);
    
    try {
      const firmFiles = await storageService.listFiles('firmas');
      const usedCertPaths = certificados.map(c => c.certificado_path);
      
      for (const file of firmFiles) {
        if (!usedCertPaths.includes(file.name)) {
          results.certificados_huerfanos.push(file.name);
        }
      }
    } catch (error) {
      results.certificados_huerfanos = [`Error: ${error.message}`];
    }
    
    // Verificar logos huérfanos
    const logosQuery = `
      SELECT DISTINCT logo 
      FROM emisor 
      WHERE logo IS NOT NULL AND logo != ''
    `;
    const { rows: logos } = await pool.query(logosQuery);
    
    try {
      const imgFiles = await storageService.listFiles('img');
      const usedLogoPaths = logos.map(l => l.logo);
      
      for (const file of imgFiles) {
        if (!usedLogoPaths.includes(file.name)) {
          results.logos_huerfanos.push(file.name);
        }
      }
    } catch (error) {
      results.logos_huerfanos = [`Error: ${error.message}`];
    }
    
    res.json({
      message: 'Análisis de archivos huérfanos completado',
      resultados: results,
      total_huerfanos: results.certificados_huerfanos.length + results.logos_huerfanos.length
    });
  } catch (error) {
    console.error('Error al limpiar archivos huérfanos:', error);
    res.status(500).json({ message: 'Error al limpiar archivos', error: error.message });
  }
};

// Configuración específica para ambientes SRI
export const setSriEnvironment = async (req, res) => {
  try {
    const { ambiente } = req.body; // 'pruebas' o 'produccion'
    
    if (!['pruebas', 'produccion'].includes(ambiente)) {
      return res.status(400).json({
        message: 'El ambiente debe ser "pruebas" o "produccion"'
      });
    }
    
    // Actualizar configuración del ambiente por defecto
    const query = `
      INSERT INTO configuracion_sistema (clave, valor, descripcion)
      VALUES ('sri_ambiente_defecto', $1, 'Ambiente por defecto para SRI')
      ON CONFLICT (clave) 
      DO UPDATE SET valor = $1, fecha_modificacion = NOW()
      RETURNING *
    `;
    
    const { rows } = await pool.query(query, [ambiente]);
    
    res.json({
      message: `Ambiente SRI configurado a: ${ambiente}`,
      configuracion: rows[0]
    });
  } catch (error) {
    console.error('Error al configurar ambiente SRI:', error);
    res.status(500).json({ message: 'Error al configurar ambiente', error: error.message });
  }
};

// Obtener configuración completa del sistema
export const getSystemInfo = async (req, res) => {
  try {
    // Configuraciones del sistema
    const configQuery = `SELECT COUNT(*) as total_configs FROM configuracion_sistema`;
    const { rows: configRows } = await pool.query(configQuery);
    
    // Configuraciones SRI
    const sriQuery = `SELECT COUNT(*) as total_sri FROM configuracion_sri`;
    const { rows: sriRows } = await pool.query(sriQuery);
    
    // Emisores configurados
    const emisorQuery = `SELECT COUNT(*) as total_emisores FROM emisor`;
    const { rows: emisorRows } = await pool.query(emisorQuery);
    
    // Storage stats
    let storageStats = {};
    try {
      for (const [bucketName, bucketKey] of Object.entries(storageService.buckets)) {
        const files = await storageService.listFiles(bucketKey);
        storageStats[bucketName] = files.length;
      }
    } catch (error) {
      storageStats = { error: error.message };
    }
    
    res.json({
      sistema: {
        configuraciones_sistema: parseInt(configRows[0].total_configs),
        configuraciones_sri: parseInt(sriRows[0].total_sri),
        emisores_registrados: parseInt(emisorRows[0].total_emisores)
      },
      storage: {
        buckets: storageService.buckets,
        estadisticas: storageStats,
        conexion: !!storageService.supabase ? 'Activa' : 'Inactiva'
      },
      fecha_consulta: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error al obtener información del sistema:', error);
    res.status(500).json({ message: 'Error al obtener información', error: error.message });
  }
};
