import express from "express";
import productRoutes from "./routes/products.routes.js";
import menuRoutes from "./routes/menu.routes.js";
import invoicesRoutes from "./routes/invoices.routes.js";
import categoriesRoutes from "./routes/categories.routes.js";
import emisorRoutes from "./routes/emisor.routes.js";
import clientRoutes from "./routes/clients.routes.js";
import authRoutes from "./routes/auth.routes.js";
import templateRoutes from "./routes/templates.routes.js";
import rolesRoutes from './routes/roles.routes.js';
import usuariosRoutes from './routes/usuarios.routes.js';
import configRoutes from './routes/config.routes.js';
import storageRoutes from './routes/storage.routes.js';
import bucketsRoutes from './routes/buckets.routes.js';
import configuracionSistemaRoutes from './routes/configuracion-sistema.routes.js';
import configuracionSriRoutes from './routes/configuracion-sri.routes.js';
import facturacionElectronicaRoutes from './routes/facturacion-electronica.routes.js';
import ventasRoutes from './routes/ventas.routes.js';

import cors from "cors";

const app = express();
const corsOptions = {
  origin: "*",
};
app.use(cors(corsOptions)); // Aplica CORS con opciones para el puerto 8100
app.use(express.json());

// Endpoint básico de salud
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API Syntory funcionando correctamente',
    timestamp: new Date().toISOString(),
    services: {
      database: 'OK',
      storage: 'OK'
    }
  });
});

app.use("/api", productRoutes);
app.use("/api", menuRoutes);
app.use("/api", invoicesRoutes);
app.use("/api", categoriesRoutes);
app.use("/api", emisorRoutes);
app.use("/api", clientRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", templateRoutes);
app.use('/api/roles', rolesRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/config', configRoutes);
app.use('/api', facturacionElectronicaRoutes);
app.use('/api/storage', storageRoutes);
app.use('/api/buckets', bucketsRoutes);
app.use('/api', configuracionSistemaRoutes);
app.use('/api', configuracionSriRoutes);
app.use('/api', ventasRoutes);

export default app;
