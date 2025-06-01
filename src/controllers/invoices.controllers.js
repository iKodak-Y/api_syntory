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
      p_punto_emision: puntoEmision.trim(), // asegurar que sea exactamente 3 caracteres
    });

    if (error) {
      console.error("Error en BD:", error);
      return res.status(500).json({
        message: "Error al obtener el secuencial",
        details: error.message,
      });
    }

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

    // Asegurar que el número secuencial tenga exactamente 9 caracteres
    const secuencial = data[0].siguiente_secuencial.padStart(9, "0");

    res.json({
      last_number: secuencial,
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

/**
 * Crea una nueva factura electrónica
 */
export const createInvoice = async (req, res) => {
  try {
    const {
      id_emisor,
      id_cliente,
      id_usuario,
      punto_emision,
      detalles,
      formas_pago,
    } = req.body;

    if (
      !id_emisor ||
      !id_cliente ||
      !id_usuario ||
      !punto_emision ||
      !detalles ||
      !formas_pago
    ) {
      return res.status(400).json({
        message: "Faltan campos requeridos",
      });
    }

    const supabase = await getConnection();

    // Obtener el siguiente número secuencial
    const { data: secuencialData } = await supabase.rpc(
      "obtener_siguiente_secuencial",
      {
        p_emisor_id: id_emisor,
        p_punto_emision: punto_emision,
      }
    );

    if (
      !secuencialData ||
      !secuencialData[0] ||
      secuencialData[0].mensaje !== "OK"
    ) {
      return res.status(400).json({
        message: "Error al obtener el número secuencial",
      });
    }

    const numero_secuencial = secuencialData[0].siguiente_secuencial.padStart(
      9,
      "0"
    );

    // Generar clave de acceso (formato: ddmmyyyytipoidrucestabptoemisecuencial)
    const fecha = new Date();
    const clave_acceso = `${fecha
      .getDate()
      .toString()
      .padStart(2, "0")}${(fecha.getMonth() + 1)
      .toString()
      .padStart(2, "0")}${fecha.getFullYear()}01${id_emisor}001${punto_emision}${numero_secuencial}12345678`;

    // Iniciar transacción
    const { data: factura, error: facturaError } = await supabase
      .from("factura_electronica")
      .insert([
        {
          id_emisor,
          id_cliente,
          id_usuario,
          clave_acceso,
          numero_secuencial,          fecha_emision: fecha.toISOString().split("T")[0],
          estado: "P", // Pendiente de envío al SRI
          punto_emision,
        },
      ])
      .select()
      .single();

    if (facturaError) throw facturaError;

    // Insertar detalles de factura
    const detallesConFactura = detalles.map((detalle) => ({
      ...detalle,
      id_factura: factura.id_factura,
    }));

    const { error: detallesError } = await supabase
      .from("detalle_factura")
      .insert(detallesConFactura);

    if (detallesError) throw detallesError;

    // Insertar formas de pago
    const pagosConFactura = formas_pago.map((pago) => ({
      ...pago,
      id_factura: factura.id_factura,
    }));

    const { error: pagosError } = await supabase
      .from("forma_pago_factura")
      .insert(pagosConFactura);

    if (pagosError) throw pagosError;

    // Retornar factura creada con todos sus detalles
    const { data: facturaCompleta, error: facturaCompletaError } = await supabase
      .from("factura_electronica")
      .select(
        `
        *,
        clientes:id_cliente (*),
        emisor:id_emisor (*),
        usuarios:id_usuario (*),
        detalle_factura (*),
        forma_pago_factura (*)
      `
      )
      .eq("id_factura", factura.id_factura)
      .single();

    if (facturaCompletaError) throw facturaCompletaError;

    res.status(201).json(facturaCompleta);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

/**
 * Actualiza el estado de una factura
 */
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, fecha_autorizacion, xml_autorizado, pdf_path } = req.body;    if (!estado) {
      return res.status(400).json({
        message: "El estado es requerido",
      });
    }

    // Validar que el estado sea válido
    const estadosValidos = ['P', 'E', 'A', 'R', 'N', 'X'];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        message: "Estado inválido. Los estados válidos son: " + estadosValidos.join(', ')
      });
    }

    const supabase = await getConnection();
    
    // Verificar el estado actual
    const { data: currentInvoice, error: getCurrentError } = await supabase
      .from("factura_electronica")
      .select("estado")
      .eq("id_factura", id)
      .single();

    if (getCurrentError) throw getCurrentError;

    if (!currentInvoice) {
      return res.status(404).json({
        message: "Factura no encontrada"
      });
    }

    // Validar la transición de estados
    const esTransicionValida = validarTransicionEstado(currentInvoice.estado, estado);
    if (!esTransicionValida.valido) {
      return res.status(400).json({
        message: esTransicionValida.mensaje
      });
    }

    const { data, error } = await supabase
      .from("factura_electronica")
      .update({
        estado,
        fecha_autorizacion,
        xml_autorizado,
        pdf_path,
      })
      .eq("id_factura", id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

/**
 * Anula una factura (cambio de estado a 'A')
 */
export const voidInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    const { motivo } = req.body;

    if (!motivo) {
      return res.status(400).json({
        message: "El motivo de anulación es requerido",
      });
    }

    const supabase = await getConnection();

    // Registrar el error/motivo de anulación
    const { error: logError } = await supabase
      .from("log_errores_factura")
      .insert([
        {
          id_factura: id,
          descripcion: motivo,
        },
      ]);

    if (logError) throw logError;    // Verificar el estado actual de la factura
    const { data: currentInvoice, error: getCurrentError } = await supabase
      .from("factura_electronica")
      .select("estado")
      .eq("id_factura", id)
      .single();

    if (getCurrentError) throw getCurrentError;

    if (!currentInvoice) {
      return res.status(404).json({
        message: "Factura no encontrada"
      });
    }

    // Solo se pueden anular facturas autorizadas
    if (currentInvoice.estado !== 'A') {
      return res.status(400).json({
        message: "Solo se pueden anular facturas autorizadas"
      });
    }

    // Actualizar estado de la factura
    const { data, error } = await supabase
      .from("factura_electronica")
      .update({
        estado: "N", // N de anulada
      })
      .eq("id_factura", id)
      .select()
      .single();

    if (error) throw error;
    res.json({
      message: "Factura anulada correctamente",
      factura: data,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

/**
 * Valida si la transición de estado es permitida
 * @param {string} estadoActual - Estado actual de la factura
 * @param {string} nuevoEstado - Estado al que se quiere cambiar
 * @returns {Object} - Objeto con la validación y mensaje
 */
const validarTransicionEstado = (estadoActual, nuevoEstado) => {
  // Definir transiciones permitidas
  const transicionesPermitidas = {
    'P': ['E', 'X'],           // De Pendiente puede pasar a Enviada o Error
    'E': ['A', 'R', 'X'],      // De Enviada puede pasar a Autorizada, Rechazada o Error
    'A': ['N'],                // De Autorizada solo puede pasar a Anulada
    'R': ['P', 'X'],          // De Rechazada puede volver a Pendiente o Error
    'X': ['P'],               // De Error puede volver a Pendiente
    'N': []                   // De Anulada no puede cambiar
  };

  // Si no existe la transición actual, no es válido
  if (!transicionesPermitidas[estadoActual]) {
    return {
      valido: false,
      mensaje: `Estado actual '${estadoActual}' no es válido`
    };
  }

  // Si el nuevo estado no está en las transiciones permitidas
  if (!transicionesPermitidas[estadoActual].includes(nuevoEstado)) {
    return {
      valido: false,
      mensaje: `No se puede cambiar de '${estadoActual}' a '${nuevoEstado}'. Estados permitidos: ${transicionesPermitidas[estadoActual].join(', ')}`
    };
  }

  return {
    valido: true,
    mensaje: 'Transición válida'
  };
};
