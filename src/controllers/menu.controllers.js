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

// Obtener menús por rol
export const getMenusByRol = async (req, res) => {
  try {
    const { id_rol } = req.params;
    const supabase = await getConnection();
    
    const { data: accesos, error } = await supabase
      .from('accesos')
      .select(`
        menu (
          id_menu,
          nombre,
          url,
          icon,
          estado
        )
      `)
      .eq('id_rol', id_rol);
    
    if (error) throw error;
    
    // Extraer solo los datos del menú
    const menus = accesos.map(acceso => acceso.menu).filter(menu => menu.estado === 'A');
    
    res.status(200).json(menus);
  } catch (error) {
    console.error('Error getting menus by rol:', error);
    res.status(500).json({ 
      message: 'Error obteniendo menús del rol', 
      error: error.message 
    });
  }
};

// Obtener accesos de un rol
export const getAccesosByRol = async (req, res) => {
  try {
    const { id_rol } = req.params;
    const supabase = await getConnection();
    
    const { data: accesos, error } = await supabase
      .from('accesos')
      .select(`
        id_acceso,
        id_menu,
        id_rol,
        fecha_registro,
        menu (
          id_menu,
          nombre,
          url,
          icon
        )
      `)
      .eq('id_rol', id_rol);
    
    if (error) throw error;
    
    res.status(200).json(accesos);
  } catch (error) {
    console.error('Error getting accesos by rol:', error);
    res.status(500).json({ 
      message: 'Error obteniendo accesos del rol', 
      error: error.message 
    });
  }
};

// Asignar permisos a un rol
export const assignPermissions = async (req, res) => {
  try {
    const { id_rol } = req.params;
    const { menus } = req.body;
    
    if (!menus || !Array.isArray(menus)) {
      return res.status(400).json({ 
        message: 'Se requiere un array de IDs de menús' 
      });
    }
    
    const supabase = await getConnection();
    
    // Verificar que el rol existe
    const { data: rol, error: rolError } = await supabase
      .from('roles')
      .select('id_rol')
      .eq('id_rol', id_rol)
      .single();
    
    if (rolError || !rol) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }
    
    // Eliminar permisos existentes
    const { error: deleteError } = await supabase
      .from('accesos')
      .delete()
      .eq('id_rol', id_rol);
    
    if (deleteError) throw deleteError;
    
    // Insertar nuevos permisos
    if (menus.length > 0) {
      const accesos = menus.map(menuId => ({
        id_rol: parseInt(id_rol),
        id_menu: menuId
      }));
      
      const { error: insertError } = await supabase
        .from('accesos')
        .insert(accesos);
      
      if (insertError) throw insertError;
    }
    
    res.status(200).json({
      message: 'Permisos asignados exitosamente'
    });
  } catch (error) {
    console.error('Error assigning permissions:', error);
    res.status(500).json({ 
      message: 'Error asignando permisos', 
      error: error.message 
    });
  }
};

// Eliminar todos los accesos de un rol
export const deleteRoleAccesos = async (req, res) => {
  try {
    const { id_rol } = req.params;
    const supabase = await getConnection();
    
    const { error } = await supabase
      .from('accesos')
      .delete()
      .eq('id_rol', id_rol);
    
    if (error) throw error;
    
    res.status(200).json({
      message: 'Accesos del rol eliminados exitosamente'
    });
  } catch (error) {
    console.error('Error deleting role accesos:', error);
    res.status(500).json({ 
      message: 'Error eliminando accesos del rol', 
      error: error.message 
    });
  }
};

// Crear un acceso individual
export const createAcceso = async (req, res) => {
  try {
    const { id_rol, id_menu } = req.body;
    
    if (!id_rol || !id_menu) {
      return res.status(400).json({ 
        message: 'Se requieren id_rol e id_menu' 
      });
    }
    
    const supabase = await getConnection();
    
    // Verificar que no existe ya este acceso
    const { data: existingAcceso } = await supabase
      .from('accesos')
      .select('id_acceso')
      .eq('id_rol', id_rol)
      .eq('id_menu', id_menu)
      .single();
    
    if (existingAcceso) {
      return res.status(400).json({ 
        message: 'El acceso ya existe' 
      });
    }
    
    // Crear el acceso
    const { data: newAcceso, error } = await supabase
      .from('accesos')
      .insert({
        id_rol: parseInt(id_rol),
        id_menu: parseInt(id_menu)
      })
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      message: 'Acceso creado exitosamente',
      acceso: newAcceso
    });
  } catch (error) {
    console.error('Error creating acceso:', error);
    res.status(500).json({ 
      message: 'Error creando acceso', 
      error: error.message 
    });
  }
};
