import { getConnection } from "../database/connection.js";
import bcrypt from 'bcrypt';

// Obtener todos los usuarios con sus roles
export const getUsuarios = async (req, res) => {
  try {
    const supabase = await getConnection();
      const { data: usuarios, error } = await supabase
      .from('usuarios')
      .select(`
        id_usuario,
        nombre_completo,
        username,
        estado,
        fecha_registro,
        id_rol,
        roles (
          id_rol,
          rol
        )
      `)
      .order('fecha_registro', { ascending: false });
    
    if (error) throw error;
    
    res.status(200).json(usuarios);
  } catch (error) {
    console.error('Error getting usuarios:', error);
    res.status(500).json({ 
      message: 'Error obteniendo usuarios', 
      error: error.message 
    });
  }
};

// Obtener un usuario por ID
export const getUsuarioById = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
      const { data: usuario, error } = await supabase
      .from('usuarios')
      .select(`
        id_usuario,
        nombre_completo,
        username,
        estado,
        fecha_registro,
        id_rol,
        roles (
          id_rol,
          rol
        )
      `)
      .eq('id_usuario', id)
      .single();
    
    if (error) throw error;
    
    if (!usuario) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    res.status(200).json(usuario);
  } catch (error) {
    console.error('Error getting usuario by ID:', error);
    res.status(500).json({ 
      message: 'Error obteniendo usuario', 
      error: error.message 
    });
  }
};

// Crear nuevo usuario
export const createUsuario = async (req, res) => {
  try {
    const { nombre_completo, username, password, id_rol } = req.body;
    
    // Validaciones básicas
    if (!nombre_completo || !username || !password || !id_rol) {
      return res.status(400).json({ 
        message: 'Todos los campos son requeridos' 
      });
    }
    
    const supabase = await getConnection();
    
    // Verificar si el username ya existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('username')
      .eq('username', username)
      .single();
    
    if (existingUser) {
      return res.status(400).json({ 
        message: 'El nombre de usuario ya existe' 
      });
    }
    
    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Crear usuario
    const { data: newUsuario, error } = await supabase
      .from('usuarios')
      .insert({
        nombre_completo,
        username,
        password: hashedPassword,
        id_rol,
        estado: 'A'
      })
      .select(`
        id_usuario,
        nombre_completo,
        username,
        estado,
        fecha_registro,
        roles (
          id_rol,
          rol
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.status(201).json({
      message: 'Usuario creado exitosamente',
      usuario: newUsuario
    });
  } catch (error) {
    console.error('Error creating usuario:', error);
    res.status(500).json({ 
      message: 'Error creando usuario', 
      error: error.message 
    });
  }
};

// Actualizar usuario
export const updateUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre_completo, username, id_rol, estado } = req.body;
    
    const supabase = await getConnection();
    
    // Verificar si el usuario existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id_usuario, username')
      .eq('id_usuario', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Verificar si el nuevo username ya existe (si se está cambiando)
    if (username && username !== existingUser.username) {
      const { data: userWithSameUsername } = await supabase
        .from('usuarios')
        .select('username')
        .eq('username', username)
        .neq('id_usuario', id)
        .single();
      
      if (userWithSameUsername) {
        return res.status(400).json({ 
          message: 'El nombre de usuario ya existe' 
        });
      }
    }
    
    // Actualizar usuario
    const updateData = {};
    if (nombre_completo) updateData.nombre_completo = nombre_completo;
    if (username) updateData.username = username;
    if (id_rol) updateData.id_rol = id_rol;
    if (estado) updateData.estado = estado;
    
    const { data: updatedUsuario, error } = await supabase
      .from('usuarios')
      .update(updateData)
      .eq('id_usuario', id)
      .select(`
        id_usuario,
        nombre_completo,
        username,
        estado,
        fecha_registro,
        roles (
          id_rol,
          rol
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
      message: 'Usuario actualizado exitosamente',
      usuario: updatedUsuario
    });
  } catch (error) {
    console.error('Error updating usuario:', error);
    res.status(500).json({ 
      message: 'Error actualizando usuario', 
      error: error.message 
    });
  }
};

// Cambiar contraseña de usuario
export const changePassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    
    if (!newPassword) {
      return res.status(400).json({ 
        message: 'La nueva contraseña es requerida' 
      });
    }
    
    const supabase = await getConnection();
    
    // Verificar si el usuario existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('id_usuario', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Actualizar contraseña
    const { error } = await supabase
      .from('usuarios')
      .update({ password: hashedPassword })
      .eq('id_usuario', id);
    
    if (error) throw error;
    
    res.status(200).json({
      message: 'Contraseña actualizada exitosamente'
    });
  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({ 
      message: 'Error cambiando contraseña', 
      error: error.message 
    });
  }
};

// Cambiar estado de usuario (activar/desactivar)
export const toggleUsuarioStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Obtener estado actual
    const { data: currentUser, error: fetchError } = await supabase
      .from('usuarios')
      .select('estado')
      .eq('id_usuario', id)
      .single();
    
    if (fetchError) throw fetchError;
    
    if (!currentUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Cambiar estado
    const newStatus = currentUser.estado === 'A' ? 'I' : 'A';
    
    const { data: updatedUsuario, error } = await supabase
      .from('usuarios')
      .update({ estado: newStatus })
      .eq('id_usuario', id)
      .select(`
        id_usuario,
        nombre_completo,
        username,
        estado,
        fecha_registro,
        roles (
          id_rol,
          rol
        )
      `)
      .single();
    
    if (error) throw error;
    
    res.status(200).json({
      message: `Usuario ${newStatus === 'A' ? 'activado' : 'desactivado'} exitosamente`,
      usuario: updatedUsuario
    });
  } catch (error) {
    console.error('Error toggling usuario status:', error);
    res.status(500).json({ 
      message: 'Error cambiando estado del usuario', 
      error: error.message 
    });
  }
};

// Eliminar usuario (soft delete)
export const deleteUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Verificar si el usuario existe
    const { data: existingUser } = await supabase
      .from('usuarios')
      .select('id_usuario')
      .eq('id_usuario', id)
      .single();
    
    if (!existingUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }
    
    // Cambiar estado a eliminado
    const { error } = await supabase
      .from('usuarios')
      .update({ estado: 'E' })
      .eq('id_usuario', id);
    
    if (error) throw error;
    
    res.status(200).json({
      message: 'Usuario eliminado exitosamente'
    });
  } catch (error) {
    console.error('Error deleting usuario:', error);
    res.status(500).json({ 
      message: 'Error eliminando usuario', 
      error: error.message 
    });
  }
};
