import { getConnection } from "../database/connection.js";
import sql from "mssql";

export const getMenus = async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query("SELECT * FROM Menu");
  res.json(result.recordset);
};

export const getMenu = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM Menu WHERE id_menu = @id");

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json(result.recordset[0]);
};
