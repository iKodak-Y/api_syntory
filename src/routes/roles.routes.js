import { Router } from "express";
import { 
  getRoles, 
  getAllRoles,
  getRolById,
  createRol,
  updateRol,
  toggleRolStatus,
  deleteRol
} from "./../controllers/roles.controllers.js";

const router = Router();

// Rutas para gestión de roles
router.get("/", getRoles);
router.get("/all", getAllRoles);
router.get("/:id", getRolById);
router.post("/", createRol);
router.put("/:id", updateRol);
router.patch("/:id/toggle-status", toggleRolStatus);
router.delete("/:id", deleteRol);

export default router;