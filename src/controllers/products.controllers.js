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
      .select("*")
      .eq("id_producto", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Product not found" });
    }
    return res.json(data);
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
