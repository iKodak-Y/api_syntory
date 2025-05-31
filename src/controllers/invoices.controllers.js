import { getConnection } from "../database/connection.js";

export const getInvoices = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("factura_electronica")
      .select(
        `
        *,
        clientes:id_cliente (nombre, apellido),
        emisor:id_emisor (razon_social),
        usuarios:id_usuario (nombre_completo),
        detalle_factura (total)
      `
      )
      .order("fecha_emision", { ascending: false });

    if (error) throw error;

    const facturasFormateadas =
      data?.map((factura) => ({
        ...factura,
        Cliente: `${factura.clientes?.nombre} ${factura.clientes?.apellido}`,
        Emisor: factura.emisor?.razon_social,
        Usuario: factura.usuarios?.nombre_completo,
        Total: factura.detalle_factura?.reduce(
          (sum, detail) => sum + detail.total,
          0
        ),
        fecha_emision: factura.fecha_emision?.split("T")[0],
      })) || [];

    res.json(facturasFormateadas);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getBill = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("factura_electronica")
      .select(
        `
        *,
        clientes:id_cliente (*),
        emisor:id_emisor (*),
        usuarios:id_usuario (*),
        detalle_factura (*)
      `
      )
      .eq("id_factura", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getLastInvoiceNumber = async (req, res) => {
  try {
    const { emisorId, puntoEmision } = req.params;
    const supabase = await getConnection();

    // Llamar a la función de la base de datos
    const { data, error } = await supabase.rpc("obtener_siguiente_secuencial", {
      p_emisor_id: parseInt(emisorId),
      p_punto_emision: puntoEmision,
    });

    if (error) throw error;

    if (!data || !data[0]) {
      return res.status(500).json({
        message: "Error al obtener el secuencial",
      });
    }

    if (data[0].mensaje !== "OK") {
      return res.status(400).json({
        error: true,
        message: data[0].mensaje,
      });
    }

    res.json({
      last_number: data[0].siguiente_secuencial,
      mensaje: "OK",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};
