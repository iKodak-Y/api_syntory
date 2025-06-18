import { getConnection } from "../database/connection.js";
import storageService from '../services/storage.service.js';

export const getEmisores = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("emisor")
      .select("*")
      .order("id_emisor");

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getEmisor = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Emisor not found" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener el primer emisor (para la configuración)
export const getPrimerEmisor = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("emisor")
      .select("*")
      .order("id_emisor", { ascending: true })
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "No hay emisores registrados" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Actualizar un emisor
export const updateEmisor = async (req, res) => {
  try {
    const { id } = req.params;
    const emisorData = req.body;
    const supabase = await getConnection();

    // Verificar que el emisor existe
    const { data: existingEmisor, error: findError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", id)
      .single();

    if (findError || !existingEmisor) {
      return res.status(404).json({ message: "Emisor no encontrado" });
    }

    // Actualizar los datos del emisor
    const { data, error } = await supabase
      .from("emisor")
      .update(emisorData)
      .eq("id_emisor", id)
      .select()
      .single();

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Crear un emisor
export const createEmisor = async (req, res) => {
  try {
    const emisorData = req.body;
    const supabase = await getConnection();

    // Crear el emisor
    const { data, error } = await supabase
      .from("emisor")
      .insert([emisorData])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Actualizar el certificado del emisor
export const updateCertificado = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ningún archivo' });
    }

    const { id } = req.params;
    const file = req.file;
    const supabase = await getConnection();

    // Verificar que el emisor existe
    const { data: existingEmisor, error: findError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", id)
      .single();

    if (findError || !existingEmisor) {
      return res.status(404).json({ message: "Emisor no encontrado" });
    }

    // Subir el certificado a Supabase Storage
    const result = await storageService.uploadCertificate(file.buffer, file.originalname);
    
    // Actualizar la ruta del certificado en la base de datos
    const { data, error } = await supabase
      .from("emisor")
      .update({
        certificado_path: result.path
      })
      .eq("id_emisor", id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      message: 'Certificado actualizado correctamente',
      file: result,
      emisor: data
    });
  } catch (error) {
    console.error('Error al actualizar certificado:', error);
    res.status(500).json({ message: 'Error al actualizar certificado', error: error.message });
  }
};

// Actualizar el logo del emisor
export const updateLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No se ha proporcionado ningún archivo' });
    }

    const { id } = req.params;
    const file = req.file;
    const supabase = await getConnection();

    // Verificar que el emisor existe
    const { data: existingEmisor, error: findError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", id)
      .single();

    if (findError || !existingEmisor) {
      return res.status(404).json({ message: "Emisor no encontrado" });
    }

    // Subir el logo a Supabase Storage
    const result = await storageService.uploadImage(file.buffer, file.originalname, file.mimetype);
    console.log('URL del logo a guardar:', result.url);
    
    // Método simplificado: Actualizar sin .select()
    console.log('Intentando actualizar emisor con ID:', id);
    
    const updateResult = await supabase
      .from("emisor")
      .update({ logo: result.url })
      .eq("id_emisor", parseInt(id));

    if (updateResult.error) {
      console.error('Error en update:', updateResult.error);
      throw updateResult.error;
    }

    // Obtener el emisor actualizado por separado
    const { data: updatedEmisor, error: selectError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", parseInt(id))
      .single();

    console.log('Logo actualizado correctamente');

    res.json({
      message: 'Logo actualizado correctamente',
      file: result,
      emisor: updatedEmisor || { id_emisor: id, logo: result.url }
    });
  } catch (error) {
    console.error('Error al actualizar logo:', error);
    res.status(500).json({ message: 'Error al actualizar logo', error: error.message });
  }
};

// Función para verificar y corregir la configuración del storage
export const checkStorageConfig = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    console.log('=== DIAGNÓSTICO DE STORAGE ===');
    
    // 1. Verificar buckets existentes
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('Error al listar buckets:', listError);
      return res.status(500).json({ error: 'Error al listar buckets', details: listError });
    }
    
    console.log('Buckets existentes:', buckets.map(b => ({
      name: b.name, 
      public: b.public,
      created_at: b.created_at
    })));
    
    // 2. Verificar si el bucket syntorystorage existe
    const syntoryBucket = buckets.find(b => b.name === 'syntorystorage');
    
    if (!syntoryBucket) {
      console.log('Bucket syntorystorage no existe. Creándolo...');
      const { data: newBucket, error: createError } = await supabase.storage.createBucket('syntorystorage', {
        public: true,
        allowedMimeTypes: ['image/*', 'application/pdf', 'application/xml', 'text/xml', 'application/pkcs12']
      });
      
      if (createError) {
        console.error('Error al crear bucket:', createError);
        return res.status(500).json({ error: 'Error al crear bucket', details: createError });
      }
      
      console.log('Bucket syntorystorage creado correctamente');
    } else {
      console.log(`Bucket syntorystorage existe. Público: ${syntoryBucket.public}`);
      
      // Si no es público, intentar actualizarlo
      if (!syntoryBucket.public) {
        console.log('Intentando hacer el bucket público...');
        const { data: updateData, error: updateError } = await supabase.storage.updateBucket('syntorystorage', {
          public: true
        });
        
        if (updateError) {
          console.error('Error al actualizar bucket:', updateError);
        } else {
          console.log('Bucket actualizado a público correctamente');
        }
      }
    }
    
    // 3. Probar subir un archivo de prueba
    const testBuffer = Buffer.from('Test file content');
    const testPath = 'test/test-file.txt';
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('syntorystorage')
      .upload(testPath, testBuffer, {
        contentType: 'text/plain',
        upsert: true
      });
    
    if (uploadError) {
      console.error('Error al subir archivo de prueba:', uploadError);
    } else {
      console.log('Archivo de prueba subido correctamente:', testPath);
      
      // 4. Probar obtener URL pública
      const { data: { publicUrl } } = supabase.storage
        .from('syntorystorage')
        .getPublicUrl(testPath);
      
      console.log('URL pública del archivo de prueba:', publicUrl);
      
      // 5. Limpiar - eliminar archivo de prueba
      await supabase.storage.from('syntorystorage').remove([testPath]);
    }
    
    // 6. Verificar archivos en la carpeta logos
    const { data: logoFiles, error: logoError } = await supabase.storage
      .from('syntorystorage')
      .list('logos');
    
    if (!logoError && logoFiles) {
      console.log('Archivos en carpeta logos:', logoFiles.map(f => f.name));
    }
    
    res.json({
      message: 'Diagnóstico completado',
      buckets: buckets.map(b => ({ name: b.name, public: b.public })),
      syntoryBucket: syntoryBucket || 'No encontrado',
      logoFiles: logoFiles || []
    });
    
  } catch (error) {
    console.error('Error en diagnóstico de storage:', error);
    res.status(500).json({ message: 'Error en diagnóstico', error: error.message });
  }
};
