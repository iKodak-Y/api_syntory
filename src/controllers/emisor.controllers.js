import { getConnection } from "../database/connection.js";
import sql from "mssql";

export const getEmisores = async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query(`SELECT * FROM Emisor`);
  res.json(result.recordset);
};

export const getEmisor = async (req, res) => {};
