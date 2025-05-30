import { getConnection } from "../database/connection.js";

export const getCategories = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('id_categoria');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getCategory = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('id_categoria', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Category not found" });
    }
    return res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

export const createCategory = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('categorias')
      .insert([{
        nombre: req.body.nombre
      }])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

export const updateCategory = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('categorias')
      .update({
        nombre: req.body.nombre,
        estado: req.body.estado
      })
      .eq('id_categoria', req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Category not found" });
    }
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

export const deleteCategory = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { error } = await supabase
      .from('categorias')
      .delete()
      .eq('id_categoria', req.params.id);

    if (error) throw error;
    return res.json({ message: "Category deleted" });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};
