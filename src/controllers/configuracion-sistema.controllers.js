import { getConnection } from "../database/connection.js";

// Obtener todas las configuraciones del sistema
export const getConfiguraciones = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .order("id_configuracion");

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener una configuración específica
export const getConfiguracion = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (error) throw error;
    if (!data)
      return res
        .status(404)
        .json({ message: `Configuración con ID ${id} no encontrada` });

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener una configuración por su clave
export const getConfiguracionPorClave = async (req, res) => {
  try {
    const { clave } = req.params;
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .eq("clave", clave)
      .eq("activo", true)
      .single();

    if (error) throw error;
    if (!data)
      return res
        .status(404)
        .json({ message: `Configuración con clave ${clave} no encontrada` });

    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Crear una nueva configuración
export const createConfiguracion = async (req, res) => {
  try {
    const configuracion = req.body;
    const supabase = await getConnection();
    
    // Verificar si la clave ya existe
    const { data: existingConfig, error: checkError } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .eq("clave", configuracion.clave)
      .maybeSingle();
    
    if (existingConfig) {
      return res.status(400).json({ message: "Ya existe una configuración con esa clave" });
    }
    
    const { data, error } = await supabase
      .from("configuracion_sistema")
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
export const updateConfiguracion = async (req, res) => {
  try {
    const { id } = req.params;
    const configuracion = req.body;
    const supabase = await getConnection();
    
    // Verificar que la configuración existe
    const { data: existingConfig, error: findError } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (findError || !existingConfig) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    
    const { data, error } = await supabase
      .from("configuracion_sistema")
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
export const deleteConfiguracion = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Verificar que la configuración existe
    const { data: existingConfig, error: findError } = await supabase
      .from("configuracion_sistema")
      .select("*")
      .eq("id_configuracion", id)
      .single();

    if (findError || !existingConfig) {
      return res.status(404).json({ message: "Configuración no encontrada" });
    }
    
    const { error } = await supabase
      .from("configuracion_sistema")
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