import { Router } from "express";
import { 
  getUsuarios, 
  getUsuarioById, 
  createUsuario, 
  updateUsuario, 
  changePassword, 
  toggleUsuarioStatus, 
  deleteUsuario 
} from "../controllers/usuarios.controllers.js";

const router = Router();

// Rutas para gestión de usuarios
router.get("/", getUsuarios);
router.get("/:id", getUsuarioById);
router.post("/", createUsuario);
router.put("/:id", updateUsuario);
router.patch("/:id/password", changePassword);
router.patch("/:id/toggle-status", toggleUsuarioStatus);
router.delete("/:id", deleteUsuario);

export default router;
