import jwt from 'jsonwebtoken';
import config from '../config.js';

export const verifyToken = (req, res, next) => {
  try {
    // Obtener el token del encabezado Authorization
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(403).json({ 
        message: 'No se proporcionó token de autenticación' 
      });
    }
    
    // Verificar el token
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    
    next();
  } catch (error) {
    console.error('Error de autenticación:', error);
    return res.status(401).json({ 
      message: 'Token inválido o expirado',
      error: error.message
    });
  }
};

export const isAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(403).json({ message: "No user information available" });
  }
  
  // Verificar si el usuario tiene rol de administrador (id_rol === 1)
  if (req.user.id_rol !== 1) {
    return res.status(403).json({ message: "Requiere privilegios de administrador" });
  }
  
  next();
};
