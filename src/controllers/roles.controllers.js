import { getConnection } from "../database/connection.js";

export const getRoles = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .eq('estado', 'A');
    
    if (error) throw error;
    
    res.status(200).json(roles);
  } catch (error) {
    console.error('Error getting roles:', error);
    res.status(500).json({ 
      message: 'Error obteniendo roles', 
      error: error.message 
    });
  }
};
