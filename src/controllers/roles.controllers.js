import { getConnection } from "../database/connection.js";

export const getRoles = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .eq('estado', 'A')
      .order('fecha_registro', { ascending: false });
    
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

// Obtener todos los roles (incluyendo inactivos)
export const getAllRoles = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data: roles, error } = await supabase
      .from('roles')
      .select('*')
      .order('fecha_registro', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json(roles);
  } catch (error) {
    console.error('Error getting all roles:', error);
    res.status(500).json({ 
      message: 'Error obteniendo todos los roles', 
      error: error.message 
    });
  }
};

// Obtener rol por ID con sus permisos
export const getRolById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    const { data: rol, error } = await supabase
      .from('roles')
      .select(`
        *,
        accesos (
          id_acceso,
          menu (
            id_menu,
            nombre,
            url,
            icon
          )
        )
      `)
      .eq('id_rol', id)
      .single();
    
    if (error) throw error;
    
    if (!rol) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }
    
    res.status(200).json(rol);
  } catch (error) {
    console.error('Error getting rol by ID:', error);
    res.status(500).json({ 
      message: 'Error obteniendo rol', 
      error: error.message 
    });
  }
};

// Crear nuevo rol
export const createRol = async (req, res) => {
  try {
    const { rol, menus = [] } = req.body;
    
    if (!rol) {
      return res.status(400).json({ 
        message: 'El nombre del rol es requerido' 
      });
    }
    
    const supabase = await getConnection();
    
    // Verificar si el rol ya existe
    const { data: existingRol } = await supabase
      .from('roles')
      .select('rol')
      .eq('rol', rol)
      .single();
    
    if (existingRol) {
      return res.status(400).json({ 
        message: 'El rol ya existe' 
      });
    }
    
    // Crear rol
    const { data: newRol, error: rolError } = await supabase
      .from('roles')
      .insert({
        rol,
        estado: 'A'
      })
      .select()
      .single();
    
    if (rolError) throw rolError;
    
    // Asignar permisos de menús si se proporcionaron
    if (menus.length > 0) {
      const accesos = menus.map(menuId => ({
        id_rol: newRol.id_rol,
        id_menu: menuId
      }));
      
      const { error: accesosError } = await supabase
        .from('accesos')
        .insert(accesos);
      
      if (accesosError) throw accesosError;
    }
    
    res.status(201).json({
      message: 'Rol creado exitosamente',
      rol: newRol
    });
  } catch (error) {
    console.error('Error creating rol:', error);
    res.status(500).json({ 
      message: 'Error creando rol', 
      error: error.message 
    });
  }
};

// Actualizar rol
export const updateRol = async (req, res) => {
  try {
    const { id } = req.params;
    const { rol, estado, menus } = req.body;
    
    const supabase = await getConnection();
    
    // Verificar si el rol existe
    const { data: existingRol } = await supabase
      .from('roles')
      .select('id_rol, rol')
      .eq('id_rol', id)
      .single();
    
    if (!existingRol) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }
    
    // Verificar si el nuevo nombre ya existe (si se está cambiando)
    if (rol && rol !== existingRol.rol) {
      const { data: rolWithSameName } = await supabase
        .from('roles')
        .select('rol')
        .eq('rol', rol)
        .neq('id_rol', id)
        .single();
      
      if (rolWithSameName) {
        return res.status(400).json({ 
          message: 'El nombre del rol ya existe' 
        });
      }
    }
    
    // Actualizar rol
    const updateData = {};
    if (rol) updateData.rol = rol;
    if (estado) updateData.estado = estado;
    
    const { data: updatedRol, error: updateError } = await supabase
      .from('roles')
      .update(updateData)
      .eq('id_rol', id)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    // Actualizar permisos de menús si se proporcionaron
    if (menus !== undefined) {
      // Eliminar permisos existentes
      await supabase
        .from('accesos')
        .delete()
        .eq('id_rol', id);
      
      // Insertar nuevos permisos
      if (menus.length > 0) {
        const accesos = menus.map(menuId => ({
          id_rol: id,
          id_menu: menuId
        }));
        
        const { error: accesosError } = await supabase
          .from('accesos')
          .insert(accesos);
        
        if (accesosError) throw accesosError;
      }
    }
    
    res.status(200).json({
      message: 'Rol actualizado exitosamente',
      rol: updatedRol
    });
  } catch (error) {
    console.error('Error updating rol:', error);
    res.status(500).json({ 
      message: 'Error actualizando rol', 
      error: error.message 
    });
  }
};

// Cambiar estado de rol (activar/desactivar)
export const toggleRolStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Obtener estado actual
    const { data: currentRol, error: fetchError } = await supabase
      .from('roles')
      .select('estado')
      .eq('id_rol', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!currentRol) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }
    
    // Cambiar estado
    const newStatus = currentRol.estado === 'A' ? 'I' : 'A';
    
    const { data: updatedRol, error } = await supabase
      .from('roles')
      .update({ estado: newStatus })
      .eq('id_rol', id)
      .select()
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
      message: `Rol ${newStatus === 'A' ? 'activado' : 'desactivado'} exitosamente`,
      rol: updatedRol
    });
  } catch (error) {
    console.error('Error toggling rol status:', error);
    res.status(500).json({ 
      message: 'Error cambiando estado del rol', 
      error: error.message 
    });
  }
};

// Eliminar rol (soft delete)
export const deleteRol = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Verificar si el rol existe
    const { data: existingRol } = await supabase
      .from('roles')
      .select('id_rol')
      .eq('id_rol', id)
      .single();
    
    if (!existingRol) {
      return res.status(404).json({ message: 'Rol no encontrado' });
    }
    
    // Verificar si hay usuarios asignados a este rol
    const { data: usuariosConRol } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('id_rol', id)
      .eq('estado', 'A');
    
    if (usuariosConRol && usuariosConRol.length > 0) {
      return res.status(400).json({ 
        message: 'No se puede eliminar el rol porque tiene usuarios asignados' 
      });
    }
    
    // Cambiar estado a eliminado
    const { error } = await supabase
      .from('roles')
      .update({ estado: 'E' })
      .eq('id_rol', id);
    
    if (error) throw error;
    
    res.status(200).json({
      message: 'Rol eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting rol:', error);
    res.status(500).json({ 
      message: 'Error eliminando rol', 
      error: error.message 
    });
  }
};
