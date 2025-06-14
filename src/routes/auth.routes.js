// auth.routes.js
import { Router } from "express";
import {
  login,
  register,
  getMenusByRol,
  validateToken,
} from "./../controllers/auth.controllers.js";

const router = Router();

router.post("/login", login);
router.post("/register", register);
router.get("/menus/:id_rol", getMenusByRol);
router.get("/validate", validateToken);

export default router;
