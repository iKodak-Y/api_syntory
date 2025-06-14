import { getConnection } from "../database/connection.js";

export const getProducts = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("productos")
      .select("*")
      .order("id_producto");

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getProduct = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("productos")
      .select(`
        *,
        categorias(
          id_categoria,
          nombre
        )
      `)
      .eq("id_producto", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Product not found" });
    }
    
    // Transformar datos para incluir nombre de categoría
    const producto = {
      ...data,
      categoria: data.categorias?.nombre || null
    };
    
    return res.json(producto);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const createProduct = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("productos")
      .insert([
        {
          codigo: req.body.codigo,
          nombre: req.body.nombre,
          precio_venta: req.body.precio_venta,
          stock_actual: req.body.stock_actual,
          iva: req.body.iva,
          id_categoria: req.body.id_categoria,
          estado: req.body.estado,
        },
      ])
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("productos")
      .update({
        codigo: req.body.codigo,
        nombre: req.body.nombre,
        precio_venta: req.body.precio_venta,
        stock_actual: req.body.stock_actual,
        iva: req.body.iva,
        id_categoria: req.body.id_categoria,
        estado: req.body.estado,
      })
      .eq("id_producto", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { error } = await supabase
      .from("productos")
      .delete()
      .eq("id_producto", req.params.id);

    if (error) throw error;
    return res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

/**
 * Busca productos por código o nombre
 */
export const searchProducts = async (req, res) => {
  try {
    const { query, searchType } = req.query;

    if (!query) {
      return res.status(400).json({
        message: "El parámetro de búsqueda es requerido",
      });
    }

    const supabase = await getConnection();
    let queryBuilder = supabase.from("productos").select("*").eq("estado", "A");

    // Si searchType es 'code', buscar coincidencia exacta del código
    // Si no, buscar por código exacto O coincidencia parcial del nombre
    if (searchType === 'code') {
      queryBuilder = queryBuilder.eq('codigo', query);
    } else {
      queryBuilder = queryBuilder.or(`codigo.eq.${query},nombre.ilike.%${query}%`);
    }

    const { data, error } = await queryBuilder.order("id_producto");

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener productos con paginación
export const getProductsPaginated = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const offset = (page - 1) * limit;

    const supabase = await getConnection();
    
    // Obtener productos con información de categoría usando una consulta simple para evitar problemas con la relación
    const { data, error, count } = await supabase
      .from("productos")
      .select(`
        *,
        categorias (
          id_categoria,
          nombre
        )
      `, { count: 'exact' })
      .eq("estado", "A")
      .range(offset, offset + limit - 1)
      .order("id_producto");

    if (error) throw error;

    // Transformar datos para incluir nombre de categoría
    const productos = data?.map(producto => ({
      ...producto,
      categoria: producto.categorias?.nombre || null
    })) || [];

    res.json({
      data: productos,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener productos más vendidos
export const getTopSellingProducts = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    // Query para obtener productos más vendidos basado en detalle_factura
    const { data, error } = await supabase
      .from("productos")
      .select(`
        *,
        categorias(nombre),
        detalle_factura!inner(cantidad)
      `)
      .eq("estado", "A")
      .order("detalle_factura.cantidad", { ascending: false })
      .limit(20);

    if (error) throw error;

    // Transformar datos
    const productos = data?.map(producto => ({
      ...producto,
      categoria: producto.categorias?.nombre || null
    })) || [];

    res.json(productos);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

// Obtener productos con stock bajo
export const getLowStockProducts = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data, error } = await supabase
      .from("productos")
      .select(`
        *,
        categorias(nombre)
      `)
      .eq("estado", "A")
      .lte("stock_actual", 10) // Stock menor o igual a 10
      .order("stock_actual");

    if (error) throw error;

    // Transformar datos
    const productos = data?.map(producto => ({
      ...producto,
      categoria: producto.categorias?.nombre || null
    })) || [];

    res.json(productos);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};
