import { getConnection } from "../database/connection.js";

export const getMenus = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .order('id_menu');

    if (error) {
      console.error('Error detallado:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: "Error interno del servidor",
      details: error.message,
      code: error?.code
    });
  }
};

export const getMenu = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('menu')
      .select('*')
      .eq('id_menu', req.params.id)
      .single();

    if (error) {
      console.error('Error detallado:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }
    
    if (!data) {
      return res.status(404).json({ message: "Menu not found" });
    }

    return res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: "Error interno del servidor",
      details: error.message,
      code: error?.code
    });
  }
};
