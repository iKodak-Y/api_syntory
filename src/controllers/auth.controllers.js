import { getConnection } from "../database/connection.js";
import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
const JWT_SECRET = process.env.JWT_SECRET || 'adminsecret';


export const login = async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validar que se reciban los datos
    if (!username || !password) {
      return res
        .status(400)
        .json({ message: "Username y contraseña son requeridos" });
    }

    // Obtener el cliente de Supabase
    const supabase = await getConnection();

    // Consultar el usuario en la tabla 'usuarios'
    const { data: users, error: userError } = await supabase
      .from("usuarios")
      .select("*")
      .eq("username", username)
      .eq("estado", "A");

    if (userError) {
      throw new Error(userError.message);
    }

    // Verificar si el usuario existe
    if (!users || users.length === 0) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    const user = users[0];
    const storedPassword = user.password;

    // Comparar la contraseña ingresada con la hasheada
    const passwordMatch = await bcrypt.compare(password, storedPassword);

    if (!passwordMatch) {
      return res.status(401).json({ message: "Credenciales incorrectas" });
    }

    // Obtener los menús asignados al rol
    const { data: menus, error: menuError } = await supabase
      .from("accesos")
      .select(`
        menu (
          id_menu,
          nombre,
          url,
          icon,
          estado
        )
      `)
      .eq("id_rol", user.id_rol);

    if (menuError) {
      throw new Error(menuError.message);
    }

    // Transformar los datos para obtener solo los menús activos
    const activeMenus = menus
      .map((acceso) => acceso.menu)
      .filter((menu) => menu.estado === "A");

    // Login exitoso
    const userData = {
      id_usuario: user.id_usuario,
      username: user.username,
      nombre_completo: user.nombre_completo,
      id_rol: user.id_rol,
      estado: user.estado,
    };

    // Generar token JWT
    const token = jwt.sign(
      { 
        id: user.id_usuario,
        username: user.username,
        rol: user.id_rol 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(200).json({
      message: "Login exitoso",
      user: userData,
      menus: activeMenus,
      token: token
    });
  } catch (error) {
    console.error("Error en login:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor", error: error.message });
  }
};


export const getMenusByRol = async (req, res) => {
  try {
    const { id_rol } = req.params;

    // Obtener el cliente de Supabase
    const supabase = await getConnection();

    // Obtener los menús asignados al rol
    const { data: accesos, error: accesosError } = await supabase
      .from("accesos")
      .select(
        `
        menu (
          id_menu,
          nombre,
          url,
          icon,
          estado
        )
      `
      )
      .eq("id_rol", id_rol);

    if (accesosError) {
      throw new Error(accesosError.message);
    }

    // Transformar los datos para obtener solo los menús
    const menus = accesos
      .map((acceso) => acceso.menu)
      .filter((menu) => menu.estado === "A");

    res.status(200).json(menus);
  } catch (error) {
    console.error("Error obteniendo menús:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor", error: error.message });
  }
};

export const register = async (req, res) => {
  try {
    const { username, password, nombre_completo, id_rol } = req.body;

    // Validar que se reciban los datos requeridos
    if (!username || !password || !nombre_completo || !id_rol) {
      return res
        .status(400)
        .json({ message: "Todos los campos son requeridos" });
    }

    // Obtener el cliente de Supabase
    const supabase = await getConnection();

    // Verificar si el usuario ya existe
    const { data: existingUser } = await supabase
      .from("usuarios")
      .select("username")
      .eq("username", username)
      .single();

    if (existingUser) {
      return res
        .status(409)
        .json({ message: "El nombre de usuario ya está en uso" });
    }

    // Hash de la contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insertar el nuevo usuario
    const { data: newUser, error: userError } = await supabase
      .from("usuarios")
      .insert([
        {
          username,
          password: hashedPassword,
          nombre_completo,
          id_rol,
          estado: "A",
        },
      ])
      .select("id_usuario, username, nombre_completo, id_rol, estado")
      .single();

    if (userError) {
      throw new Error(userError.message);
    }

    // Obtener los menús asignados al rol
    const { data: menus, error: menuError } = await supabase
      .from("accesos")
      .select(
        `
        menu (
          id_menu,
          nombre,
          url,
          icon,
          estado
        )
      `
      )
      .eq("id_rol", id_rol);

    if (menuError) {
      throw new Error(menuError.message);
    }

    // Transformar los datos para obtener solo los menús activos
    const activeMenus = menus
      .map((acceso) => acceso.menu)
      .filter((menu) => menu.estado === "A");

    // Registro exitoso
    res.status(201).json({
      message: "Usuario registrado exitosamente",
      user: newUser,
      menus: activeMenus,
    });
  } catch (error) {
    console.error("Error en registro:", error);
    res
      .status(500)
      .json({ message: "Error en el servidor", error: error.message });
  }
};

export const validateToken = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      res.status(200).json({ 
        valid: true, 
        user: decoded 
      });
    });
  } catch (error) {
    console.error('Error validating token:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};