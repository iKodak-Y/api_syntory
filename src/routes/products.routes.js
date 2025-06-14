import { Router } from 'express';
import { 
    createProduct, 
    deleteProduct, 
    getProduct, 
    getProducts,
    getProductsPaginated,
    getTopSellingProducts,
    getLowStockProducts,
    updateProduct,
    searchProducts 
} from './../controllers/products.controllers.js';

const router = Router();

// La ruta de búsqueda debe ir antes que las rutas con parámetros
router.get("/productos/search", searchProducts);
router.get("/productos/paginated", getProductsPaginated);
router.get("/productos/top-selling", getTopSellingProducts);
router.get("/productos/low-stock", getLowStockProducts);
router.get("/productos/:id", getProduct);
router.get("/productos", getProducts);
router.post("/productos", createProduct);
router.put("/productos/:id", updateProduct);
router.delete("/productos/:id", deleteProduct);

export default router;