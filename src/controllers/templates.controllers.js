import { getConnection } from "../database/connection.js";

export const getTemplates = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("info_adicional_template")
      .select("*")
      .eq("estado", "S")
      .order("nombre", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

export const getTemplateById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("info_adicional_template")
      .select("*")
      .eq("id_template", id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Template no encontrado" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

export const createTemplate = async (req, res) => {
  try {
    const { id_emisor, nombre, descripcion } = req.body;

    if (!id_emisor || !nombre || !descripcion) {
      return res.status(400).json({
        message: "Faltan campos requeridos (id_emisor, nombre, descripcion)",
      });
    }

    const supabase = await getConnection();

    // Verificar si ya existe un template con el mismo nombre para este emisor
    const { data: existingTemplate, error: searchError } = await supabase
      .from("info_adicional_template")
      .select("id_template")
      .eq("id_emisor", id_emisor)
      .eq("nombre", nombre)
      .eq("estado", "S");

    if (searchError) throw searchError;

    if (existingTemplate && existingTemplate.length > 0) {
      return res.status(400).json({
        message: "Ya existe un template con este nombre para este emisor",
      });
    }

    const { data, error } = await supabase
      .from("info_adicional_template")
      .insert([
        {
          id_emisor,
          nombre,
          descripcion,
          estado: "S",
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

export const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion } = req.body;

    if (!nombre || !descripcion) {
      return res.status(400).json({
        message: "Faltan campos requeridos (nombre, descripcion)",
      });
    }

    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("info_adicional_template")
      .update({
        nombre,
        descripcion,
      })
      .eq("id_template", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Template no encontrado" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

export const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();

    // Soft delete: actualizar estado a 'N'
    const { data, error } = await supabase
      .from("info_adicional_template")
      .update({ estado: "N" })
      .eq("id_template", id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Template no encontrado" });
    }
    res.json({ message: "Template eliminado correctamente" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};
