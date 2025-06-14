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


import cors from "cors";

const app = express();
const corsOptions = {
  origin: "*",
};
app.use(cors(corsOptions)); // Aplica CORS con opciones para el puerto 8100
app.use(express.json());

app.use("/api", productRoutes);
app.use("/api", menuRoutes);
app.use("/api", invoicesRoutes);
app.use("/api", categoriesRoutes);
app.use("/api", emisorRoutes);
app.use("/api", clientRoutes);
app.use("/api/auth", authRoutes);
app.use("/api", templateRoutes);
app.use('/api/roles', rolesRoutes);

export default app;
