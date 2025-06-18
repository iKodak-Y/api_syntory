import { getConnection } from "../database/connection.js";
import {
  generarFacturaElectronica,
  generarXmlFactura,
  firmarXml,
  enviarDocumentoRecepcion,
  solicitarAutorizacion,
  guardarXml,
  prepararConfiguracionFactura,
  verificarEstadoFactura
} from "../services/facturacion-electronica.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import PDFDocument from 'pdfkit';

// Obtener la ruta base del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Controlador para emitir una factura electrónica
 */
export const emitirFacturaElectronica = async (req, res) => {
  try {
    console.log("=== INICIO EMISIÓN FACTURA ELECTRÓNICA ===");
    console.log("Datos recibidos:", JSON.stringify(req.body, null, 2));
    
    // Extraer datos necesarios
    const {
      id_emisor,
      id_cliente,
      id_usuario,
      punto_emision,
      detalles,
      formas_pago,
      numero_secuencial,
      fecha_emision,
      ambiente_sri = 'pruebas'
    } = req.body;

    // Validaciones básicas
    if (!id_emisor || !id_cliente || !punto_emision || !detalles || !formas_pago) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para emitir factura",
        campos_requeridos: ["id_emisor", "id_cliente", "punto_emision", "detalles", "formas_pago"]
      });
    }

    const supabase = await getConnection();

    // Obtener datos del emisor
    console.log("Buscando emisor con ID:", id_emisor);
    const { data: emisor, error: emisorError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", id_emisor)
      .single();

    if (emisorError || !emisor) {
      return res.status(404).json({
        success: false,
        message: "Emisor no encontrado",
        error: emisorError?.message
      });
    }

    // Obtener datos del cliente
    console.log("Buscando cliente con ID:", id_cliente);
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("*")
      .eq("id_cliente", id_cliente)
      .single();

    if (clienteError || !cliente) {
      return res.status(404).json({
        success: false,
        message: "Cliente no encontrado",
        error: clienteError?.message
      });
    }

    // Validar detalles
    if (!Array.isArray(detalles) || detalles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Se requiere al menos un producto"
      });
    }

    // Validar formas de pago
    if (!Array.isArray(formas_pago) || formas_pago.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Se requiere al menos una forma de pago"
      });
    }

    // Obtener o generar secuencial
    let secuencial;
    if (numero_secuencial) {
      secuencial = numero_secuencial.replace(/^0+/, '') || '1'; // Remover ceros iniciales
      console.log("Usando secuencial proporcionado:", secuencial);
    } else {
      secuencial = await getLastInvoiceNumberFromDB(emisor.id_emisor, punto_emision);
      console.log("Secuencial generado automáticamente:", secuencial);
    }

    try {      // 1. Preparar configuración para factura electrónica
      const facturaConfig = await prepararConfiguracionFactura(
        emisor,
        cliente,
        punto_emision,
        secuencial,
        fecha_emision,
        detalles,
        formas_pago
      );
      
      console.log("Configuración de factura preparada");
      
      // 2. Generar factura electrónica (objeto y clave de acceso)
      const { invoice, accessKey } = await generarFacturaElectronica(facturaConfig);
      console.log("Factura generada con clave de acceso:", accessKey);
      
      // 3. Generar XML de la factura
      const xmlContent = await generarXmlFactura(invoice);
      console.log("XML generado exitosamente");
      
      // 4. Guardar XML no firmado
      const xmlNoFirmadoPath = guardarXml(xmlContent, `factura_${accessKey}`, 'no-firmados');
      console.log("XML no firmado guardado en:", xmlNoFirmadoPath);
      
      // Variables para el resultado
      let estadoSRI = "P"; // Pendiente por defecto
      let numeroAutorizacion = "";
      let xmlFirmado = xmlContent;
      let xmlAutorizadoContent = null;
      
      // 5. Determinar ambiente SRI
      const ambienteSRI = emisor.tipo_ambiente === "produccion" ? "produccion" : "pruebas";
        // 6. Verificar si existe certificado digital para firma
      const tieneCertificado = emisor.certificado_path && emisor.contrasena_certificado;
      console.log(`Certificado configurado: ${emisor.certificado_path ? 'SÍ' : 'NO'}, Contraseña configurada: ${emisor.contrasena_certificado ? 'SÍ' : 'NO'}`);
      
      if (!tieneCertificado) {
        console.log("MODO SIMULADO: Sin certificado digital válido");
        
        // Modo simulado para desarrollo
        estadoSRI = "A"; // Autorizado (simulado)
        numeroAutorizacion = `SIMULADO-${Date.now()}`;
        
        // Persistir factura en modo simulado
        const facturaGuardada = await guardarFacturaDB(
          supabase,
          id_emisor,
          id_cliente,
          id_usuario,
          accessKey,
          secuencial,
          punto_emision,
          ambienteSRI,
          estadoSRI,
          numeroAutorizacion,
          xmlContent,
          null,
          facturaConfig.infoFactura.totalSinImpuestos,
          facturaConfig.infoFactura.totalConImpuestos[0].valor,
          facturaConfig.infoFactura.importeTotal,
          detalles,
          formas_pago,
          req.body.info_adicional
        );
          // Respuesta en modo simulado con estructura compatible con fronted
        return res.status(201).json({
          success: true,
          message: "Factura creada en modo simulado (desarrollo)",
          factura: {
            id_factura: facturaGuardada.id_factura,
            ...facturaGuardada
          },
          clave_acceso: accessKey,
          xml_generado: true,
          firmado: false,
          estado_sri: estadoSRI,  // "A" para Autorizado
          numero_autorizacion: numeroAutorizacion,
          modo_simulado: true,
          nota: "Para producción necesitas configurar un certificado digital válido"
        });
      }
      
      // 7. Firmar XML con certificado digital
      try {
        console.log("Firmando XML con certificado:", emisor.certificado_path);
        xmlFirmado = await firmarXml(xmlContent, emisor.certificado_path, emisor.contrasena_certificado);
        console.log("XML firmado exitosamente");
        
        // Guardar XML firmado
        const xmlFirmadoPath = guardarXml(xmlFirmado, `factura_firmada_${accessKey}`, 'firmados');
        console.log("XML firmado guardado en:", xmlFirmadoPath);
      } catch (signError) {
        console.error("Error al firmar XML:", signError);
        
        return res.status(500).json({
          success: false,
          message: "Error al firmar el XML",
          details: signError.message,
          error_completo: signError.stack
        });
      }
      
      // 8. Enviar al SRI para recepción
      try {
        console.log(`Enviando factura al SRI - Ambiente: ${ambienteSRI}`);
        
        const receptionResult = await enviarDocumentoRecepcion(xmlFirmado, ambienteSRI);
        console.log("Resultado de recepción:", JSON.stringify(receptionResult, null, 2));
        
        // 9. Manejar respuesta de recepción
        if (receptionResult && (receptionResult.estado === "RECIBIDA" || receptionResult.comprobante === "RECIBIDA")) {
          console.log("✓ Documento recibido exitosamente por el SRI");
          
          // 10. Solicitar autorización
          try {
            // Dar tiempo al SRI para procesar
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            const authorizationResult = await solicitarAutorizacion(accessKey, ambienteSRI);
            console.log("Resultado de autorización:", JSON.stringify(authorizationResult, null, 2));
            
            // 11. Manejar respuesta de autorización
            if (authorizationResult && (authorizationResult.estado === "AUTORIZADO" || authorizationResult.comprobante === "AUTORIZADA")) {
              estadoSRI = "A"; // Autorizado
              numeroAutorizacion = authorizationResult.numeroAutorizacion || authorizationResult.claveAcceso || accessKey;
              console.log("✓ Factura autorizada por el SRI");
              
              // Actualizar XML con la respuesta autorizada si está disponible
              if (authorizationResult.comprobante) {
                xmlAutorizadoContent = authorizationResult.comprobante;
              } else {
                xmlAutorizadoContent = xmlFirmado;
              }
              
              // Guardar XML autorizado
              const xmlAutorizadoPath = guardarXml(xmlAutorizadoContent, `factura_autorizada_${accessKey}`, 'autorizados');
              console.log("XML autorizado guardado en:", xmlAutorizadoPath);
              
            } else if (authorizationResult && authorizationResult.estado === "EN_PROCESAMIENTO") {
              estadoSRI = "E"; // Enviada (en procesamiento)
              numeroAutorizacion = accessKey;
              console.log("⏳ Documento en procesamiento por el SRI");
              
            } else {
              estadoSRI = "R"; // Rechazado
              const mensajes = authorizationResult?.mensajes || authorizationResult?.informacionAdicional || ["Sin detalles del rechazo"];
              console.log("✗ Factura rechazada por el SRI:", mensajes);
              
              return res.status(400).json({
                success: false,
                message: "La factura fue rechazada por el SRI en autorización",
                details: Array.isArray(mensajes) ? mensajes : [mensajes],
                estado: estadoSRI,
                clave_acceso: accessKey,
                respuesta_sri: authorizationResult
              });
            }
            
          } catch (authError) {
            console.error("Error en autorización:", authError);
            estadoSRI = "E"; // Enviada pero error en autorización
            numeroAutorizacion = accessKey;
          }
          
        } else {
          estadoSRI = "R"; // Rechazado en recepción
          const mensajes = receptionResult?.mensajes || receptionResult?.informacionAdicional || ["Error desconocido en recepción"];
          
          return res.status(400).json({
            success: false,
            message: "El documento fue rechazado en la recepción del SRI",
            details: Array.isArray(mensajes) ? mensajes : [mensajes],
            estado: estadoSRI,
            clave_acceso: accessKey,
            respuesta_sri: receptionResult
          });
        }
        
      } catch (sriError) {
        console.error("Error al comunicarse con el SRI:", sriError);
        estadoSRI = "X"; // Error
        
        return res.status(500).json({
          success: false,
          message: "Error al comunicarse con el SRI",
          details: sriError.message,
          error_completo: sriError.stack
        });
      }
      
      // 12. Guardar factura en la base de datos
      const xmlToSave = xmlAutorizadoContent || xmlFirmado;
      const facturaGuardada = await guardarFacturaDB(
        supabase,
        id_emisor,
        id_cliente,
        id_usuario,
        accessKey,
        secuencial,
        punto_emision,
        ambienteSRI,
        estadoSRI,
        numeroAutorizacion,
        xmlToSave,
        null,
        facturaConfig.infoFactura.totalSinImpuestos,
        facturaConfig.infoFactura.totalConImpuestos[0].valor,
        facturaConfig.infoFactura.importeTotal,
        detalles,
        formas_pago,
        req.body.info_adicional
      );
      
      // 13. Generar PDF si la factura está autorizada
      let pdfPath = null;
      if (estadoSRI === "A") {
        try {
          pdfPath = await generarPDF(
            facturaGuardada,
            emisor,
            cliente,
            detalles,
            formas_pago,
            accessKey,
            numeroAutorizacion
          );
          
          // Actualizar ruta del PDF en la base de datos
          await supabase
            .from("factura_electronica")
            .update({ pdf_path: pdfPath })
            .eq("id_factura", facturaGuardada.id_factura);
            
          console.log("PDF generado y almacenado en:", pdfPath);
        } catch (pdfError) {
          console.error("Error al generar PDF:", pdfError);
          // No fallamos la operación principal si el PDF falla
        }
      }
      
      // 14. Respuesta final
      return res.status(201).json({
        success: true,
        message: `Factura ${estadoSRI === "A" ? "autorizada" : "procesada"} exitosamente`,
        factura: facturaGuardada,
        clave_acceso: accessKey,
        xml_generado: true,
        firmado: true,
        estado_sri: estadoSRI,
        numero_autorizacion: numeroAutorizacion,
        pdf_path: pdfPath,
        modo_simulado: false,
        ambiente_sri: ambienteSRI
      });
      
    } catch (error) {
      console.error("Error en el proceso de emisión:", error);
      return res.status(500).json({
        success: false,
        message: "Error en el proceso de emisión de factura",
        details: error.message,
        stack: error.stack
      });
    }
  } catch (error) {
    console.error("Error general:", error);
    return res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      details: error.message
    });
  }
};

/**
 * Consulta el estado de una factura en el SRI
 */
export const consultarEstadoFacturaSRI = async (req, res) => {
  try {
    const { clave_acceso } = req.params;
    
    if (!clave_acceso || clave_acceso.length !== 49) {
      return res.status(400).json({
        success: false,
        message: "Clave de acceso inválida. Debe tener 49 caracteres."
      });
    }
    
    // Determinar ambiente basado en el 23er carácter de la clave de acceso
    // 1 = Pruebas, 2 = Producción
    const ambiente = clave_acceso.charAt(23) === '1' ? 'pruebas' : 'produccion';
    console.log(`Consultando estado de factura ${clave_acceso} en ambiente ${ambiente}`);
    
    // Consultar estado en SRI
    const estadoFactura = await verificarEstadoFactura(clave_acceso, ambiente);
    
    // Actualizar en la base de datos si está autorizada
    if (estadoFactura.estado === 'AUTORIZADO' || estadoFactura.estado === 'AUTORIZADA') {
      const supabase = await getConnection();
      
      // Buscar factura existente
      const { data: factura } = await supabase
        .from("factura_electronica")
        .select("id_factura, estado")
        .eq("clave_acceso", clave_acceso)
        .single();
      
      if (factura) {
        // Si la factura no estaba autorizada, la actualizamos
        if (factura.estado !== 'A') {
          await supabase
            .from("factura_electronica")
            .update({
              estado: 'A',
              fecha_autorizacion: new Date().toISOString(),
              numero_autorizacion: estadoFactura.numero_autorizacion,
              // Si hay comprobante XML del SRI, actualizamos
              ...(estadoFactura.comprobante ? { xml_autorizado: estadoFactura.comprobante } : {})
            })
            .eq("id_factura", factura.id_factura);
        }
      }
    }
    
    // Respuesta con estado
    return res.json({
      success: true,
      estado: estadoFactura.estado,
      mensaje: estadoFactura.mensaje,
      fecha_autorizacion: estadoFactura.fecha_autorizacion,
      numero_autorizacion: estadoFactura.numero_autorizacion
    });
  } catch (error) {
    console.error("Error al consultar estado:", error);
    return res.status(500).json({
      success: false,
      message: "Error al consultar el estado de la factura",
      details: error.message
    });
  }
};

/**
 * Consulta el último número de secuencial disponible
 */
export const obtenerSecuencial = async (req, res) => {
  try {
    const { emisorId, puntoEmision } = req.params;
    const supabase = await getConnection();

    const secuencial = await getLastInvoiceNumberFromDB(emisorId, puntoEmision);
    
    res.json({
      success: true,
      last_number: secuencial.padStart(9, "0"),
      mensaje: "OK",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      success: false,
      message: "Error al obtener el secuencial",
      details: error.message,
    });
  }
};

/**
 * Obtiene el último número de factura de la base de datos
 */
async function getLastInvoiceNumberFromDB(emisorId, puntoEmision) {
  const supabase = await getConnection();
  
  const { data, error } = await supabase.rpc("obtener_siguiente_secuencial", {
    p_emisor_id: parseInt(emisorId),
    p_punto_emision: puntoEmision.trim(),
  });

  if (error) {
    throw new Error(`Error al obtener secuencial: ${error.message}`);
  }

  if (!data || !data[0]) {
    throw new Error("No se pudo obtener el secuencial");
  }

  if (data[0].mensaje !== "OK") {
    throw new Error(data[0].mensaje);
  }

  return data[0].siguiente_secuencial;
}

/**
 * Guarda una factura en la base de datos
 */
async function guardarFacturaDB(
  supabase,
  id_emisor,
  id_cliente,
  id_usuario,
  clave_acceso,
  numero_secuencial,
  punto_emision,
  ambiente_sri,
  estado,
  numero_autorizacion,
  xml_autorizado,
  pdf_path,
  subtotal,
  iva_total,
  total,
  detalles,
  formas_pago,
  info_adicional
) {
  // Crear registro principal de factura
  const { data: facturaDB, error: facturaError } = await supabase
    .from("factura_electronica")
    .insert([
      {
        id_emisor,
        id_cliente,
        id_usuario,
        clave_acceso,
        numero_secuencial,
        fecha_emision: new Date().toISOString().split("T")[0],
        estado,
        fecha_autorizacion: estado === "A" ? new Date().toISOString() : null,
        xml_autorizado,
        pdf_path,
        punto_emision,
        ambiente_sri,
        numero_autorizacion,
        subtotal,
        iva_total,
        total,
      },
    ])
    .select()
    .single();

  if (facturaError) throw facturaError;

  // Insertar detalles
  const detallesConFactura = detalles.map((d) => ({
    ...d,
    id_factura: facturaDB.id_factura,
    descripcion: d.descripcion || `Producto ${d.id_producto}`,
  }));
  await supabase.from("detalle_factura").insert(detallesConFactura);

  // Insertar formas de pago
  const pagosConFactura = formas_pago.map((p) => ({
    ...p,
    id_factura: facturaDB.id_factura,
  }));
  await supabase.from("forma_pago_factura").insert(pagosConFactura);

  // Insertar información adicional si existe
  if (info_adicional && Array.isArray(info_adicional) && info_adicional.length > 0) {
    const infoAdicionalConFactura = info_adicional.map((info) => ({
      ...info,
      id_factura: facturaDB.id_factura,
    }));
    await supabase.from("info_adicional_factura").insert(infoAdicionalConFactura);
  }

  return facturaDB;
}

/**
 * Genera un PDF de la factura
 */
async function generarPDF(factura, emisor, cliente, detalles, formas_pago, clave_acceso, numero_autorizacion) {
  return new Promise((resolve, reject) => {
    try {
      // Crear carpeta si no existe
      const pdfDir = path.join(path.resolve(__dirname, "../.."), "comprobantes", "pdf");
      if (!fs.existsSync(pdfDir)) {
        fs.mkdirSync(pdfDir, { recursive: true });
      }
      
      const pdfPath = path.join(pdfDir, `factura_${clave_acceso}.pdf`);
      const doc = new PDFDocument({ margin: 50 });
      
      const writeStream = fs.createWriteStream(pdfPath);
      doc.pipe(writeStream);
      
      // Encabezado
      doc.fontSize(20).text("FACTURA ELECTRÓNICA", { align: 'center' });
      doc.moveDown();
      
      // Datos del emisor
      doc.fontSize(12).fillColor("#444444");
      doc.text(`Emisor: ${emisor.razon_social}`);
      doc.text(`RUC: ${emisor.ruc}`);
      doc.text(`Dirección: ${emisor.direccion}`);
      doc.moveDown();
      
      // Datos de la factura
      doc.text(`Factura #: ${factura.numero_secuencial}`);
      doc.text(`Fecha de Emisión: ${factura.fecha_emision}`);
      doc.text(`Clave de Acceso: ${clave_acceso}`);
      doc.text(`Autorización: ${numero_autorizacion}`);
      doc.moveDown();
      
      // Datos del cliente
      doc.text(`Cliente: ${cliente.nombre} ${cliente.apellido || ''}`);
      doc.text(`${cliente.cedula_ruc.length === 13 ? 'RUC' : 'Cédula'}: ${cliente.cedula_ruc}`);
      doc.text(`Dirección: ${cliente.direccion || 'N/A'}`);
      doc.text(`Email: ${cliente.email || 'N/A'}`);
      doc.moveDown();
      
      // Tabla de productos
      doc.fontSize(10);
      const tableTop = doc.y;
      const tableHeaders = ['Cantidad', 'Descripción', 'P. Unitario', 'Descuento', 'Subtotal', 'IVA', 'Total'];
      const tableData = detalles.map(d => [
        Number(d.cantidad).toFixed(2),
        d.descripcion || `Producto ${d.id_producto}`,
        `$${Number(d.precio_unitario).toFixed(2)}`,
        `$${Number(d.descuento || 0).toFixed(2)}`,
        `$${Number(d.subtotal).toFixed(2)}`,
        `$${(Number(d.subtotal) * Number(d.iva || 0.15)).toFixed(2)}`,
        `$${(Number(d.subtotal) * (1 + Number(d.iva || 0.15))).toFixed(2)}`
      ]);
      
      // Dibujar tabla
      let i;
      const invoiceTableTop = doc.y + 30;
      doc.font("Helvetica-Bold");
      
      let tableX = 50;
      const columnWidth = (doc.page.width - 100) / tableHeaders.length;
      
      for (i = 0; i < tableHeaders.length; i++) {
        doc.text(tableHeaders[i], tableX, invoiceTableTop);
        tableX += columnWidth;
      }
      
      doc.font("Helvetica");
      let tableRow = invoiceTableTop + 20;
      
      for (i = 0; i < tableData.length; i++) {
        tableX = 50;
        for (let j = 0; j < tableData[i].length; j++) {
          doc.text(tableData[i][j], tableX, tableRow);
          tableX += columnWidth;
        }
        tableRow += 20;
      }
      
      // Totales
      doc.moveDown();
      const totalesX = 350;
      doc.fontSize(10).font("Helvetica-Bold").text("Subtotal:", totalesX, tableRow);
      doc.text("IVA (15%):", totalesX, tableRow + 20);
      doc.text("Total:", totalesX, tableRow + 40);
      
      doc.fontSize(10).font("Helvetica")
        .text(`$${Number(factura.subtotal).toFixed(2)}`, totalesX + 100, tableRow)
        .text(`$${Number(factura.iva_total).toFixed(2)}`, totalesX + 100, tableRow + 20)
        .text(`$${Number(factura.total).toFixed(2)}`, totalesX + 100, tableRow + 40);
      
      // Formas de pago
      doc.moveDown();
      doc.fontSize(12).font("Helvetica-Bold").text("Formas de Pago:", 50, tableRow + 80);
      doc.font("Helvetica");
      
      let formasPagoY = tableRow + 100;
      formas_pago.forEach((forma, index) => {
        doc.text(`${index + 1}. ${forma.forma_pago}: $${Number(forma.valor_pago || forma.valor).toFixed(2)}`, 70, formasPagoY);
        formasPagoY += 20;
      });
      
      // Pie de página
      const pageHeight = doc.page.height;
      doc.fontSize(8).text(
        "DOCUMENTO GENERADO ELECTRÓNICAMENTE",
        50,
        pageHeight - 50,
        { align: "center" }
      );
      
      doc.end();
      
      writeStream.on('finish', () => {
        resolve(pdfPath);
      });
      
      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
}
