import { Router } from 'express';
import { createCategory, deleteCategory, getCategories, getCategory, updateCategory } from './../controllers/categories.controllers.js';

const router = Router();

router.get("/category", getCategories);
router.get("/category/:id", getCategory);
router.post("/category", createCategory);
router.put("/category/:id", updateCategory);
router.delete("/category/:id", deleteCategory);

export default router;