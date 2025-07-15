// Script para ajustar la zona horaria en el servidor API

/**
 * Este archivo debe añadirse al inicio de la aplicación (app.js o index.js)
 * Para configurar correctamente la zona horaria del servidor.
 */

// Instalación previa requerida: npm install moment-timezone --save
import moment from 'moment-timezone';

// Configurar la zona horaria del servidor para Ecuador (o ajustar según tu ubicación)
process.env.TZ = 'America/Guayaquil';

// Log para verificar la configuración
console.log(`[CONFIG] Servidor configurado en zona horaria: ${process.env.TZ}`);
console.log(`[CONFIG] Hora actual del servidor: ${new Date().toLocaleString()}`);
console.log(`[CONFIG] Hora en UTC: ${new Date().toUTCString()}`);

// Opcional: configurar moment.js para usar la misma zona horaria por defecto
moment.tz.setDefault(process.env.TZ);

// Si deseas hacer un middleware para ajustar automáticamente fechas en solicitudes:
export const timeZoneMiddleware = (req, res, next) => {
  if (req.body && req.body.fecha_registro) {
    // Garantizar que las fechas enviadas por el cliente estén en la zona horaria correcta
    req.body.fecha_registro = moment(req.body.fecha_registro).tz(process.env.TZ).format();
  }
  next();
};
