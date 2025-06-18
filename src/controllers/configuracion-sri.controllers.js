import { getConnection } from "../database/connection.js";

// Obtener la configuración del SRI (por defecto la primera)
export const getConfiguracionSRI = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sri")
      .select("*")
      .order("id_configuracion", { ascending: true })
      .limit(1)
      .single();

    if (error) {
      // Si no hay registros, crear uno por defecto
      if (error.code === 'PGRST116') {
        const defaultConfig = {
          url_pruebas: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantes?wsdl',
          url_produccion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantes?wsdl',
          fecha_vigencia_inicio: new Date().toISOString().split('T')[0],
          descripcion: 'Configuración por defecto'
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
    const supabase = await getConnection();
    
    const { data, error } = await supabase
      .from("configuracion_sri")
      .insert([configuracion])
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

// Actualizar una configuración
export const updateConfiguracionSRI = async (req, res) => {
  try {
    const { id } = req.params;
    const configuracion = req.body;
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
    
    const { data, error } = await supabase
      .from("configuracion_sri")
      .update(configuracion)
      .eq("id_configuracion", id)
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
