import { getConnection } from "../database/connection.js";
import sql from "mssql";

export const getProducts = async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query("SELECT * FROM PRODUCTOS");
  res.json(result.recordset);
};

export const getProduct = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM Productos WHERE id_producto = @id");

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json(result.recordset[0]);
};

export const createProduct = async (req, res) => {
  console.log(req.body);

  const pool = await getConnection();
  const result = await pool
    .request()
    .input("codigo", sql.VarChar, req.body.codigo)
    .input("nombre", sql.NVarChar, req.body.nombre)
    .input("precio_venta", sql.Decimal, req.body.precio_venta)
    .input("stock_actual", sql.Int, req.body.stock_actual)
    .input("iva", sql.Decimal, req.body.iva)
    .input("id_categoria", sql.Int, req.body.id_categoria)
    .input("estado", sql.Char, req.body.estado)
    .query(
      "INSERT INTO PRODUCTOS (codigo, nombre, precio_venta, stock_actual, iva, id_categoria, estado) VALUES (@codigo, @nombre, @precio_venta, @stock_actual, @iva, @id_categoria, @estado); SELECT SCOPE_IDENTITY() AS id;"
    );

  res.json({
    id: result.recordset[0].id,
    codigo: req.body.codigo,
    nombre: req.body.nombre,
    precio_venta: req.body.precio_venta,
    stock_actual: req.body.stock_actual,
    iva: req.body.iva,
    id_categoria: req.body.id_categoria,
    estado: req.body.estado,
  });
};

export const updateProduct = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id_producto", sql.Int, req.params.id)
    .input("codigo", sql.VarChar, req.body.codigo)
    .input("nombre", sql.NVarChar, req.body.nombre)
    .input("precio_venta", sql.Decimal, req.body.precio_venta)
    .input("stock_actual", sql.Int, req.body.stock_actual)
    .input("iva", sql.Decimal, req.body.iva)
    .input("id_categoria", sql.Int, req.body.id_categoria)
    .input("estado", sql.Char, req.body.estado)
    .query(
      "UPDATE Productos SET codigo = @codigo, nombre = @nombre, precio_venta = @precio_venta, stock_actual = @stock_actual, iva = @iva, id_categoria = @id_categoria, estado = @estado WHERE id_producto = @id_producto"
    );

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }
  res.json({
    id: req.params.id,
    codigo: req.body.codigo,
    nombre: req.body.nombre,
    precio_venta: req.body.precio_venta,
    stock_actual: req.body.stock_actual,
    iva: req.body.iva,
    id_categoria: req.body.id_categoria,
    estado: req.body.estado,
  });
};

export const deleteProduct = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("DELETE FROM Productos WHERE id_producto = @id");

  console.log(result);
  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json({ message: "Product deleted" });
};
