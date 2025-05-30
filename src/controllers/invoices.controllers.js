import { getConnection } from "../database/connection.js";
import sql from "mssql";

export const getInvoices = async (req, res) => {
  const pool = await getConnection();
  const result = await pool.request().query(`SELECT
    CONCAT(C.Nombre, ' ', C.Apellido) AS Cliente,
    E.razon_social AS Emisor,
    U.nombre_completo AS Usuario,
    F.fecha_emision,
    F.clave_acceso,
    F.numero_secuencial,
    SUM(D.total) AS Total,
    F.estado
FROM FacturaElectronica F
JOIN Clientes C ON F.id_cliente = C.id_cliente
JOIN Emisor E ON F.id_emisor = E.id_emisor
JOIN Usuarios U ON F.id_usuario = U.id_usuario
JOIN DetalleFactura D ON F.id_factura = D.id_factura
GROUP BY
    C.Nombre,
    C.Apellido,
    E.razon_social,
    U.nombre_completo,
    F.fecha_emision,
    F.clave_acceso,
    F.numero_secuencial,
    F.estado,
    F.fecha_emision,
    F.clave_acceso,
    F.numero_secuencial,
    F.estado`);

  const facturasFormateadas = result.recordset.map((factura) => ({
    ...factura,
    fecha_emision: factura.fecha_emision.toISOString().split("T")[0],
  }));

  res.json(facturasFormateadas);
};

export const getBill = async (req, res) => {
  const pool = await getConnection();
  const result = await pool
    .request()
    .input("id", sql.Int, req.params.id)
    .query("SELECT * FROM FacturaElectronica WHERE id_factura = @id");

  if (result.rowsAffected[0] === 0) {
    return res.status(404).json({ message: "Product not found" });
  }

  return res.json(result.recordset[0]);
};
