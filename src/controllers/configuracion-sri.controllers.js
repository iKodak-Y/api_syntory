import { getConnection } from "../database/connection.js";

// Obtener la configuración del SRI activa
export const getConfiguracionSRI = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("activo", true)
      .order("fecha_registro", { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Si no hay registros, crear uno por defecto
      if (error.code === 'PGRST116') {
        const defaultConfig = {
          url_recepcion_pruebas: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
          url_recepcion_produccion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
          url_autorizacion_pruebas: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
          url_autorizacion_produccion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl',
          ambiente_defecto: 'pruebas',
          timeout_conexion: 30000,
          max_reintentos: 3,
          tiempo_entre_reintentos: 5000,
          fecha_vigencia_inicio: new Date().toISOString().split('T')[0],
          activo: true,
          descripcion: 'Configuración por defecto URLs SRI Ecuador',
          version_sri: '1.0'
        };
        
        const { data: newData, error: createError } = await supabase
          .from("configuracion_sri")
          .insert([defaultConfig])
          .select()
          .single();
          
        if (createError) throw createError;
        return res.json(newData);
      } else {
        throw error;
      }
    }

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener URLs según el ambiente especificado
export const getUrlsSRI = async (req, res) => {
  try {
    const { ambiente = 'pruebas' } = req.query;
    const supabase = await getConnection();
    
    const { data, error } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("activo", true)
      .order("fecha_registro", { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "No hay configuración SRI activa" });
    }

    const urls = {
      url_recepcion: ambiente === 'produccion' ? data.url_recepcion_produccion : data.url_recepcion_pruebas,
      url_autorizacion: ambiente === 'produccion' ? data.url_autorizacion_produccion : data.url_autorizacion_pruebas,
      timeout_conexion: data.timeout_conexion,
      max_reintentos: data.max_reintentos,
      tiempo_entre_reintentos: data.tiempo_entre_reintentos,
      ambiente: ambiente,
      version_sri: data.version_sri
    };

    res.json(urls);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener una configuración específica
export const getConfiguracionSRIById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Crear una nueva configuración
export const createConfiguracionSRI = async (req, res) => {
  try {
    const configuracion = req.body;
    console.log('➕ Creando nueva configuración SRI:', configuracion);
    
    const supabase = await getConnection();
    
    // Si se marca como activa, desactivar las demás
    if (configuracion.activo) {
      await supabase
        .from("configuracion_sri")
        .update({ activo: false })
        .neq("id_configuracion", -1); // Actualizar todas
    }
    
    // Filtrar campos auto-generados antes de insertar
    const { 
      id_configuracion, 
      fecha_registro, 
      fecha_modificacion, 
      ...insertData 
    } = configuracion;
    
    console.log('📤 Datos filtrados para inserción:', insertData);
    
    const { data, error } = await supabase
      .from("configuracion_sri")
      .insert([insertData])
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Configuración creada exitosamente:', data);
    res.status(201).json(data);
  } catch (error) {
    console.error("❌ Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Actualizar una configuración
export const updateConfiguracionSRI = async (req, res) => {
  try {
    const { id } = req.params;
    const configuracion = req.body;
    
    console.log('🔄 Actualizando configuración SRI ID:', id);
    console.log('📝 Datos recibidos:', configuracion);
    
    const supabase = await getConnection();
    
    // Verificar que la configuración existe
    const { data: existingConfig, error: findError } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (findError || !existingConfig) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    
    // Si se marca como activa, desactivar las demás
    if (configuracion.activo) {
      await supabase
        .from("configuracion_sri")
        .update({ activo: false })
        .neq("id_configuracion", id);
    }
    
    // Filtrar campos que no deben actualizarse (auto-generados)
    const { 
      id_configuracion, 
      fecha_registro, 
      fecha_modificacion, 
      ...updateData 
    } = configuracion;
    
    console.log('📤 Datos filtrados para actualización:', updateData);
    
    const { data, error } = await supabase
      .from("configuracion_sri")
      .update(updateData)
      .eq("id_configuracion", id)
      .select()
      .single();

    if (error) throw error;
    
    console.log('✅ Configuración actualizada exitosamente:', data);
    res.json(data);
  } catch (error) {
    console.error("❌ Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Activar una configuración específica
export const activarConfiguracionSRI = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Verificar que la configuración existe
    const { data: existingConfig, error: findError } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (findError || !existingConfig) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    
    // Desactivar todas las configuraciones
    await supabase
      .from("configuracion_sri")
      .update({ activo: false })
      .neq("id_configuracion", -1);
    
    // Activar la configuración específica
    const { data, error } = await supabase
      .from("configuracion_sri")
      .update({ activo: true })
      .eq("id_configuracion", id)
      .select()
      .single();

    if (error) throw error;
    res.json({ message: "Configuración activada correctamente", data });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Cambiar ambiente por defecto
export const cambiarAmbienteDefecto = async (req, res) => {
  try {
    const { ambiente } = req.body; // 'pruebas' o 'produccion'
    
    if (!['pruebas', 'produccion'].includes(ambiente)) {
      return res.status(400).json({ 
        message: "Ambiente inválido. Debe ser 'pruebas' o 'produccion'" 
      });
    }
    
    const supabase = await getConnection();
    
    // Actualizar la configuración activa
    const { data, error } = await supabase
      .from("configuracion_sri")
      .update({ ambiente_defecto: ambiente })
      .eq("activo", true)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "No hay configuración SRI activa" });
    }
    
    res.json({ 
      message: `Ambiente cambiado a ${ambiente} correctamente`, 
      data 
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener todas las configuraciones
export const getAllConfiguracionesSRI = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sri")
      .select("*")
      .order("fecha_registro", { ascending: false });

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Eliminar una configuración
export const deleteConfiguracionSRI = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Verificar que la configuración existe
    const { data: existingConfig, error: findError } = await supabase
      .from("configuracion_sri")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (findError || !existingConfig) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    
    const { error } = await supabase
      .from("configuracion_sri")
      .delete()
      .eq("id_configuracion", id);

    if (error) throw error;
    res.status(204).send();
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};
