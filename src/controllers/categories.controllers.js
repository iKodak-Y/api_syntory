import { getConnection } from "../database/connection.js";
import sql from "mssql";

export const getCategories = async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query("SELECT * FROM Categorias");
  res.json(result.recordset);
};

export const getCategory = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM Categorias WHERE id_categoria = @id");

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json(result.recordset[0]);
};

export const createCategory = async (req, res) => {
  console.log(req.body);

  const pool = await getConnection();
  const result = await pool
    .request()
    .input("nombre", sql.NVarChar, req.body.nombre)
    .query(
      `INSERT INTO Categorias (nombre)
         OUTPUT INSERTED.id_categoria, INSERTED.nombre, INSERTED.estado, INSERTED.fecha_registro
         VALUES (@nombre)`
    );

  const newCategory = result.recordset[0];

  res.json({
    id: newCategory.id_categoria,
    nombre: newCategory.nombre,
    estado: newCategory.estado,
    fecha_registro: newCategory.fecha_registro,
  });
};

export const updateCategory = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, req.params.id)
    .input("nombre", sql.NVarChar, req.body.nombre)
    .input("estado", sql.Char, req.body.estado)
    .query(
      "UPDATE Categorias SET nombre = @nombre, estado = @estado WHERE id_categoria = @id_categoria"
    );

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }
  res.json({
    id: req.params.id,
    nombre: req.body.nombre,
    estado: req.body.estado,
  });
};

export const deleteCategory = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id_categoria", sql.Int, req.params.id)
    .query("DELETE FROM Categorias WHERE id_categoria = @id_categoria");

  console.log(result);
  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }
  return res.json({ message: "Product deleted" });
};
