import { Router } from 'express';
import { createCategory, deleteCategory, getCategories, getCategory, updateCategory } from './../controllers/categories.controllers.js';

const router = Router();

router.get("/categorias", getCategories);
router.get("/categorias/:id", getCategory);
router.post("/categorias", createCategory);
router.put("/categorias/:id", updateCategory);
router.delete("/categorias/:id", deleteCategory);

export default router;