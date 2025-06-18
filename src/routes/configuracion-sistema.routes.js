import { Router } from 'express';
import { 
  getConfiguraciones, 
  getConfiguracion, 
  getConfiguracionPorClave,
  createConfiguracion, 
  updateConfiguracion, 
  deleteConfiguracion 
} from '../controllers/configuracion-sistema.controllers.js';
import { verifyToken, isAdmin } from '../middlewares/auth.middleware.js';
import { getConnection } from "../database/connection.js";

const router = Router();

// Rutas públicas
router.get("/configuracion-sistema", getConfiguraciones);
router.get("/configuracion-sistema/:id", getConfiguracion);
router.get("/configuracion-sistema/clave/:clave", getConfiguracionPorClave);
router.get("/configuracion-sistema/valor/:clave", async (req, res) => {
  try {
    const { clave } = req.params;
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("valor, tipo")
      .eq("clave", clave)
      .eq("activo", true)
      .single();

    if (error) throw error;
    if (!data) 
      return res.status(404).json({ message: `Configuración con clave ${clave} no encontrada` });

    // Convertir valor según tipo
    let valor = data.valor;
    if (data.tipo === 'numero' || data.tipo === 'number') {
      valor = Number(valor);
    } else if (data.tipo === 'booleano' || data.tipo === 'boolean') {
      valor = valor === 'true' || valor === '1' || valor === 'si';
    } else if (data.tipo === 'json') {
      try {
        valor = JSON.parse(valor);
      } catch (e) {
        console.error(`Error al parsear JSON para configuración ${clave}:`, e);
      }
    }

    res.json({ clave, valor });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
});

// Rutas protegidas
router.post("/configuracion-sistema", verifyToken, isAdmin, createConfiguracion);
router.put("/configuracion-sistema/:id", verifyToken, isAdmin, updateConfiguracion);
router.delete("/configuracion-sistema/:id", verifyToken, isAdmin, deleteConfiguracion);

export default router;