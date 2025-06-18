import { getConnection } from "../database/connection.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
import PDFDocument from "pdfkit";
import { StorageService } from "./storage.service.js";

// Obtener la ruta base del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Generar número secuencial para las ventas
 * @param {string} puntoEmision - Punto de emisión (ej: '001')
 * @returns {string} Número secuencial generado
 */
export async function generarNumeroSecuencial(puntoEmision) {
  try {
    const supabase = await getConnection();

    // Obtener el último secuencial del punto de emisión
    const { data, error } = await supabase
      .from("ventas")
      .select("numero_secuencial")
      .eq("punto_emision", puntoEmision)
      .order("numero_secuencial", { ascending: false })
      .limit(1);

    if (error) {
      console.error("Error obteniendo último secuencial:", error);
      throw error;
    }

    let proximoSecuencial = 1;

    if (data && data.length > 0) {
      const ultimoSecuencial = parseInt(data[0].numero_secuencial) || 0;
      proximoSecuencial = ultimoSecuencial + 1;
    }

    // Formatear con ceros a la izquierda (9 dígitos)
    return proximoSecuencial.toString().padStart(9, "0");
  } catch (error) {
    console.error("Error generando número secuencial:", error);
    throw new Error("Error generando número secuencial: " + error.message);
  }
}

/**
 * Calcular totales de una venta
 * @param {Array} detalles - Array de detalles de productos
 * @returns {Object} Totales calculados {subtotal, iva_total, total}
 */
export function calcularTotales(detalles) {
  let subtotal = 0;
  let iva_total = 0;
  let total = 0;

  detalles.forEach((detalle) => {
    const cantidad = parseFloat(detalle.cantidad) || 0;
    const precio_unitario = parseFloat(detalle.precio_unitario) || 0;
    const tasa_iva = parseFloat(detalle.tasa_iva) || 0.15;
    const descuento = parseFloat(detalle.descuento) || 0;

    // Calcular subtotal del item (precio * cantidad - descuento)
    const subtotal_item = cantidad * precio_unitario - descuento;

    // Calcular IVA del item
    const iva_item = subtotal_item * tasa_iva;

    // Calcular total del item
    const total_item = subtotal_item + iva_item;

    // Actualizar valores en el detalle
    detalle.subtotal = subtotal_item;
    detalle.valor_iva = iva_item;
    detalle.total = total_item;

    // Sumar a los totales generales
    subtotal += subtotal_item;
    iva_total += iva_item;
    total += total_item;
  });

  return {
    subtotal: parseFloat(subtotal.toFixed(2)),
    iva_total: parseFloat(iva_total.toFixed(2)),
    total: parseFloat(total.toFixed(2)),
  };
}

/**
 * Validar stock de productos
 * @param {Array} detalles - Array de detalles de productos
 * @returns {Object} Resultado de validación {valido: boolean, errores: Array}
 */
export async function validarStock(detalles) {
  try {
    const supabase = await getConnection();
    const errores = [];

    for (const detalle of detalles) {
      const { data: producto, error } = await supabase
        .from("productos")
        .select("id_producto, nombre, stock_actual")
        .eq("id_producto", detalle.id_producto)
        .single();

      if (error || !producto) {
        errores.push(`Producto con ID ${detalle.id_producto} no encontrado`);
        continue;
      }

      const cantidadRequerida = parseFloat(detalle.cantidad) || 0;

      if (producto.stock_actual < cantidadRequerida) {
        errores.push(
          `Stock insuficiente para ${producto.nombre}. ` +
            `Disponible: ${producto.stock_actual}, Requerido: ${cantidadRequerida}`
        );
      }
    }

    return {
      valido: errores.length === 0,
      errores,
    };
  } catch (error) {
    console.error("Error validando stock:", error);
    return {
      valido: false,
      errores: ["Error validando stock: " + error.message],
    };
  }
}

/**
 * Actualizar stock de productos después de una venta
 * @param {Array} detalles - Array de detalles de productos
 */
export async function actualizarStock(detalles) {
  try {
    const supabase = await getConnection();

    for (const detalle of detalles) {
      const cantidadVendida = parseFloat(detalle.cantidad) || 0;

      // Obtener stock actual
      const { data: producto, error: getError } = await supabase
        .from("productos")
        .select("stock_actual")
        .eq("id_producto", detalle.id_producto)
        .single();

      if (getError || !producto) {
        throw new Error(`Producto con ID ${detalle.id_producto} no encontrado`);
      }

      // Calcular nuevo stock
      const nuevoStock = producto.stock_actual - cantidadVendida;

      // Actualizar stock
      const { error: updateError } = await supabase
        .from("productos")
        .update({ stock_actual: nuevoStock })
        .eq("id_producto", detalle.id_producto);

      if (updateError) {
        throw new Error(
          `Error actualizando stock del producto ${detalle.id_producto}: ${updateError.message}`
        );
      }

      console.log(
        `Stock actualizado para producto ${detalle.id_producto}: ${producto.stock_actual} -> ${nuevoStock}`
      );
    }
  } catch (error) {
    console.error("Error actualizando stock:", error);
    throw error;
  }
}

/**
 * Generar PDF de una venta
 * @param {number} id_venta - ID de la venta
 * @returns {string} Ruta del archivo PDF generado
 */
export async function generarPDFVenta(id_venta) {
  try {
    const supabase = await getConnection();

    // Obtener datos completos de la venta
    const { data: venta, error } = await supabase
      .from("ventas")
      .select(
        `
        *,
        clientes(
          nombre,
          apellido,
          cedula_ruc,
          direccion,
          telefono,
          email,
          tipo_identificacion
        ),
        usuarios(
          nombre_completo
        ),
        emisor(
          ruc,
          razon_social,
          nombre_comercial,
          direccion,
          logo
        ),
        detalle_venta(
          descripcion,
          cantidad,
          precio_unitario,
          subtotal,
          valor_iva,
          total,
          tasa_iva,
          descuento
        ),
        forma_pago_venta(
          forma_pago,
          valor_pago
        ),
        info_adicional_venta(
          nombre,
          descripcion
        )
      `
      )
      .eq("id_venta", id_venta)
      .single();

    if (error || !venta) {
      throw new Error("Venta no encontrada");
    }

    // Crear el documento PDF en memoria con márgenes más ajustados
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });
    const chunks = [];

    // Recoger los chunks del PDF en memoria
    doc.on("data", (chunk) => chunks.push(chunk));

    // === ENCABEZADO PRINCIPAL ===
    await generarEncabezadoPDF(doc, venta);

    // === INFORMACIÓN DEL CLIENTE ===
    generarInfoClientePDF(doc, venta);

    // === TABLA DE PRODUCTOS ===
    generarTablaProductosPDF(doc, venta);
    // === TOTALES ===
    generarTotalesPDF(doc, venta);

    // === PIE DE PÁGINA ===
    generarPiePaginaPDF(doc, venta);

    // Finalizar el documento
    doc.end();

    // Esperar a que se complete la generación del PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);
    });

    // Subir el PDF a Supabase Storage
    const storageService = new StorageService();
    const fileName = `venta_${venta.numero_secuencial}_${Date.now()}.pdf`;

    const uploadResult = await storageService.uploadFile(
      pdfBuffer,
      "ventas", // bucket name
      fileName,
      "application/pdf",
      "comprobantes" // folder dentro del bucket
    );

    console.log(`PDF generado y subido exitosamente: ${uploadResult.url}`);

    // Retornar la URL de Supabase Storage
    return uploadResult.url;
  } catch (error) {
    console.error("Error generando PDF:", error);
    throw new Error("Error generando PDF: " + error.message);
  }
}

/**
 * Generar PDF con datos proporcionados directamente (para pruebas)
 * @param {Object} venta - Datos completos de la venta
 * @returns {string} URL del PDF generado
 */
export async function generarPDFDirecto(venta) {
  try {
    console.log("=== GENERANDO PDF DIRECTO ===");
    console.log("Datos de venta:", JSON.stringify(venta, null, 2));

    // Crear el documento PDF en memoria con márgenes más ajustados
    const doc = new PDFDocument({
      margin: 40,
      size: "A4",
    });
    const chunks = [];

    // Recoger los chunks del PDF en memoria
    doc.on("data", (chunk) => chunks.push(chunk));

    // === ENCABEZADO PRINCIPAL ===
    await generarEncabezadoPDF(doc, venta);

    // === INFORMACIÓN DEL CLIENTE ===
    generarInfoClientePDF(doc, venta);

    // === TABLA DE PRODUCTOS ===
    generarTablaProductosPDF(doc, venta);

    // === TOTALES ===
    generarTotalesPDF(doc, venta);

    // === PIE DE PÁGINA ===
    generarPiePaginaPDF(doc, venta);

    // Finalizar el documento
    doc.end();

    // Esperar a que se complete la generación del PDF
    const pdfBuffer = await new Promise((resolve, reject) => {
      doc.on("end", () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", reject);
    });

    // Subir el PDF a Supabase Storage
    const storageService = new StorageService();
    const fileName = `venta_test_${venta.numero_secuencial}_${Date.now()}.pdf`;

    const uploadResult = await storageService.uploadFile(
      pdfBuffer,
      "ventas", // bucket name
      fileName,
      "application/pdf",
      "comprobantes" // folder dentro del bucket
    );

    console.log(
      `PDF de prueba generado y subido exitosamente: ${uploadResult.url}`
    );

    // Retornar la URL de Supabase Storage
    return uploadResult.url;
  } catch (error) {
    console.error("Error generando PDF directo:", error);
    throw new Error("Error generando PDF directo: " + error.message);
  }
}

/**
 * Obtener configuración de IVA por defecto
 * @returns {number} Valor del IVA por defecto
 */
export async function obtenerIvaDefecto() {
  try {
    const supabase = await getConnection();

    const { data, error } = await supabase
      .from("configuracion_sistema")
      .select("valor")
      .eq("clave", "iva_defecto")
      .single();

    if (error || !data) {
      console.log(
        "No se encontró configuración de IVA, usando valor por defecto: 0.15"
      );
      return 0.15;
    }

    return parseFloat(data.valor) || 0.15;
  } catch (error) {
    console.error("Error obteniendo IVA por defecto:", error);
    return 0.15;
  }
}

/**
 * Generar encabezado del PDF estilo SRI
 */
async function generarEncabezadoPDF(doc, venta) {
  const pageWidth = doc.page.width - 80; // Ancho útil de la página

  // === SECCIÓN IZQUIERDA: DATOS DEL EMISOR ===
  const leftWidth = pageWidth * 0.65;
  const rightWidth = pageWidth * 0.35;

  // Rectángulo para datos del emisor
  doc.rect(40, 40, leftWidth, 140).stroke();

  let yPos = 50;

  // Logo (si existe) - espacio reservado en la esquina superior izquierda
  if (venta.emisor.logo) {
    try {
      // TODO: Implementar carga de logo desde Supabase Storage
      doc.fontSize(8).text("[LOGO]", 50, yPos);
    } catch (error) {
      console.log("Error cargando logo:", error);
    }
  }

  // Información del emisor centrada
  yPos = 65;
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text(
    (venta.emisor.razon_social || venta.emisor.nombre_comercial).toUpperCase(),
    50,
    yPos,
    {
      width: leftWidth - 20,
      align: "center",
    }
  );
  yPos += 18;

  // Nombre comercial 
  if (
    venta.emisor.nombre_comercial &&
    venta.emisor.razon_social !== venta.emisor.nombre_comercial
  ) {
    doc.fontSize(11).font("Helvetica");
    doc.text(venta.emisor.nombre_comercial.toUpperCase(), 50, yPos, {
      width: leftWidth - 20,
      align: "center",
    });
    yPos += 15;
  }

  // Dirección Matrix principal
  doc.fontSize(9).font("Helvetica");
  if (venta.emisor.direccion) {
    doc.text(
      `Dirección Matriz: ${venta.emisor.direccion.toUpperCase()}`,
      50,
      yPos,
      {
        width: leftWidth - 20,
        align: "center",
      }
    );
    yPos += 12;
  }

// Dirección sucursal (si aplica)
  doc.text("", 50, yPos, {
    width: leftWidth - 20,
    align: "center",
  });
  yPos += 25;

  // Obligado a llevar contabilidad
  doc.text("OBLIGADO A LLEVAR CONTABILIDAD: NO", 50, yPos, {
    width: leftWidth - 20,
    align: "center",
  });

  // === SECCIÓN DERECHA: DATOS DE LA FACTURA ===
  const rightX = 40 + leftWidth;

  // Rectángulo para datos de la factura
  doc.rect(rightX, 40, rightWidth, 140).stroke();

  yPos = 50;

  // RUC
  doc.fontSize(10).font("Helvetica-Bold");
  doc.text("R.U.C: " + venta.emisor.ruc, rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 20;

  // FACTURA
  doc.fontSize(14).font("Helvetica-Bold");
  doc.text("FACTURA", rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 20;

  // Número de factura
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text(
    `No. ${venta.punto_emision}-${venta.numero_secuencial}`,
    rightX + 5,
    yPos,
    {
      width: rightWidth - 10,
      align: "center",
    }
  );
  yPos += 20;

  // Número de autorización (simulado)
  doc.fontSize(8).font("Helvetica");
  doc.text("", rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 10;
  doc.text(
    "",
    rightX + 5,
    yPos,
    {
      width: rightWidth - 10,
      align: "center",
    }
  );
  yPos += 15;

  // Fecha y hora de autorización
  doc.text("FECHA Y HORA DE AUTORIZACIÓN:", rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 8;
  const fechaHora = new Date().toLocaleString("es-ES");
  doc.text(fechaHora, rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 12;

  // Ambiente
  doc.text("AMBIENTE: PRODUCCIÓN", rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });
  yPos += 10;

  // Emisión
  doc.text("EMISIÓN: NORMAL", rightX + 5, yPos, {
    width: rightWidth - 10,
    align: "center",
  });

  doc.y = 190; // Posición después del encabezado
}

/**
 * Generar información del cliente
 */
function generarInfoClientePDF(doc, venta) {
  const pageWidth = doc.page.width - 80;
  const yStart = doc.y;

  // Rectángulo para datos del cliente
  doc.rect(40, yStart, pageWidth, 60).stroke();

  let yPos = yStart + 8;

  // Razón Social / Nombres y Apellidos
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Razón Social / Nombres y Apellidos:", 50, yPos);

  const clienteNombre = venta.clientes
    ? `${venta.clientes.nombre} ${venta.clientes.apellido || ""}`.trim()
    : "CONSUMIDOR FINAL";

  doc.font("Helvetica");
  doc.text(clienteNombre.toUpperCase(), 230, yPos);
  yPos += 15;

  // Identificación y Fecha en la misma línea
  doc.font("Helvetica-Bold");
  doc.text("Identificación:", 50, yPos);
  doc.text("Fecha:", 300, yPos);

  doc.font("Helvetica");
  const identificacion = venta.clientes
    ? venta.clientes.cedula_ruc
    : "9999999999999";
  doc.text(identificacion, 130, yPos);
  doc.text(
    new Date(venta.fecha_emision).toLocaleDateString("es-ES"),
    340,
    yPos
  );
  yPos += 15;

  // Dirección
  doc.font("Helvetica-Bold");
  doc.text("Dirección:", 50, yPos);

  doc.font("Helvetica");
  const direccion =
    venta.clientes && venta.clientes.direccion
      ? venta.clientes.direccion.toUpperCase()
      : "N/A";
  doc.text(direccion, 130, yPos);

  doc.y = yStart + 70;
}

/**
 * Generar tabla de productos
 */
function generarTablaProductosPDF(doc, venta) {
  const pageWidth = doc.page.width - 80;
  const yStart = doc.y;

  // Calcular altura necesaria para la tabla
  const rowHeight = 15;
  const headerHeight = 25;
  const tableHeight =
    headerHeight + venta.detalle_venta.length * rowHeight + 10;

  // Rectángulo para la tabla
  doc.rect(40, yStart, pageWidth, tableHeight).stroke();

  // Definir columnas según la imagen SRI
  const colWidths = {
    codigo: 60,
    cantidad: 50,
    descripcion: 200,
    precio: 70,
    descuento: 60,
    total: 70,
  };

  let xPos = 45;
  let yPos = yStart + 8;

  // Encabezados de tabla
  doc.fontSize(8).font("Helvetica-Bold");

  doc.text("Cód.", xPos, yPos, {
    width: colWidths.codigo - 5,
    align: "center",
  });
  xPos += colWidths.codigo;

  doc.text("Cant.", xPos, yPos, {
    width: colWidths.cantidad - 5,
    align: "center",
  });
  xPos += colWidths.cantidad;

  doc.text("Descripción", xPos, yPos, {
    width: colWidths.descripcion - 5,
    align: "center",
  });
  xPos += colWidths.descripcion;

  doc.text("Precio", xPos, yPos, {
    width: colWidths.precio - 5,
    align: "center",
  });
  doc.text("Unitario", xPos, yPos + 8, {
    width: colWidths.precio - 5,
    align: "center",
  });
  xPos += colWidths.precio;

  doc.text("Descuento", xPos, yPos, {
    width: colWidths.descuento - 5,
    align: "center",
  });
  xPos += colWidths.descuento;

  doc.text("Precio Total", xPos, yPos, {
    width: colWidths.total - 5,
    align: "center",
  });

  yPos += headerHeight;

  // Línea separadora
  doc
    .moveTo(40, yPos - 5)
    .lineTo(40 + pageWidth, yPos - 5)
    .stroke();

  // Líneas verticales para separar columnas
  let currentX = 40;
  doc
    .moveTo(currentX + colWidths.codigo, yStart)
    .lineTo(currentX + colWidths.codigo, yStart + tableHeight)
    .stroke();
  currentX += colWidths.codigo;
  doc
    .moveTo(currentX + colWidths.cantidad, yStart)
    .lineTo(currentX + colWidths.cantidad, yStart + tableHeight)
    .stroke();
  currentX += colWidths.cantidad;
  doc
    .moveTo(currentX + colWidths.descripcion, yStart)
    .lineTo(currentX + colWidths.descripcion, yStart + tableHeight)
    .stroke();
  currentX += colWidths.descripcion;
  doc
    .moveTo(currentX + colWidths.precio, yStart)
    .lineTo(currentX + colWidths.precio, yStart + tableHeight)
    .stroke();
  currentX += colWidths.precio;
  doc
    .moveTo(currentX + colWidths.descuento, yStart)
    .lineTo(currentX + colWidths.descuento, yStart + tableHeight)
    .stroke();

  // Filas de productos
  doc.fontSize(8).font("Helvetica");
  venta.detalle_venta.forEach((detalle, index) => {
    xPos = 45;

    // Código del producto (simulado)
    doc.text(`${String(index + 1).padStart(4, "0")}`, xPos, yPos, {
      width: colWidths.codigo - 5,
      align: "center",
    });
    xPos += colWidths.codigo;

    // Cantidad
    doc.text(detalle.cantidad.toFixed(0), xPos, yPos, {
      width: colWidths.cantidad - 5,
      align: "center",
    });
    xPos += colWidths.cantidad;

    // Descripción
    doc.text(detalle.descripcion.toUpperCase(), xPos, yPos, {
      width: colWidths.descripcion - 5,
    });
    xPos += colWidths.descripcion;

    // Precio unitario
    doc.text(`$${detalle.precio_unitario.toFixed(2)}`, xPos, yPos, {
      width: colWidths.precio - 5,
      align: "right",
    });
    xPos += colWidths.precio;

    // Descuento
    doc.text(`$${(detalle.descuento || 0).toFixed(2)}`, xPos, yPos, {
      width: colWidths.descuento - 5,
      align: "right",
    });
    xPos += colWidths.descuento;

    // Total
    doc.text(`$${detalle.total.toFixed(2)}`, xPos, yPos, {
      width: colWidths.total - 5,
      align: "right",
    });

    yPos += rowHeight;

    // Línea horizontal entre productos
    if (index < venta.detalle_venta.length - 1) {
      doc
        .moveTo(40, yPos - 2)
        .lineTo(40 + pageWidth, yPos - 2)
        .stroke();
    }
  });

  doc.y = yStart + tableHeight + 10;
}

/**
 * Generar sección de totales
 */
function generarTotalesPDF(doc, venta) {
  const pageWidth = doc.page.width - 80;
  const yStart = doc.y;

  // Información adicional a la izquierda y totales a la derecha
  const leftWidth = pageWidth * 0.58;
  const rightWidth = pageWidth * 0.42;

  // Rectángulo izquierdo para información adicional
  doc.rect(40, yStart, leftWidth, 180).stroke();

  let yPos = yStart + 10;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Información Adicional", 45, yPos);
  yPos += 15;

  doc.fontSize(8).font("Helvetica");
  if (venta.clientes && venta.clientes.telefono) {
    doc.text(`Teléfono: ${venta.clientes.telefono}`, 45, yPos);
    yPos += 12;
  }

  if (venta.clientes && venta.clientes.email) {
    doc.text(`Email: ${venta.clientes.email}`, 45, yPos);
    yPos += 12;
  }

  // Agregar información adicional de la venta si existe
  if (venta.info_adicional_venta && venta.info_adicional_venta.length > 0) {
    venta.info_adicional_venta.forEach((info) => {
      doc.text(`${info.nombre}: ${info.descripcion}`, 45, yPos, {
        width: leftWidth - 20,
      });
      yPos += 12;
    });
  }

  // Formas de pago en la sección izquierda
  yPos += 10;
  doc.fontSize(9).font("Helvetica-Bold");
  doc.text("Forma de Pago:", 45, yPos);
  yPos += 12;

  doc.fontSize(8).font("Helvetica");
  venta.forma_pago_venta.forEach((pago) => {
    const formaPagoTexto = formatearFormaPago(pago.forma_pago);
    doc.text(`${formaPagoTexto}: $${pago.valor_pago.toFixed(2)}`, 45, yPos);
    yPos += 12;
  });

  // Rectángulo derecho para totales
  const rightX = 40 + leftWidth;
  doc.rect(rightX, yStart, rightWidth, 180).stroke();

  yPos = yStart + 10;
  doc.fontSize(9).font("Helvetica");

  // Calcular subtotales según el formato SRI
  const subtotal15 = venta.subtotal;
  const subtotal0 = 0;
  const subtotalNoObjeto = 0;
  const subtotalExento = 0;
  const descuentoTotal = 0;

  // SUBTOTAL 15%
  doc.text("SUBTOTAL 15%", rightX + 5, yPos);
  doc.text(`$${subtotal15.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // SUBTOTAL 0%
  doc.text("SUBTOTAL 0%", rightX + 5, yPos);
  doc.text(`$${subtotal0.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // SUBTOTAL NO OBJETO DE IVA
  doc.text("SUBTOTAL NO OBJETO DE IVA", rightX + 5, yPos);
  doc.text(`$${subtotalNoObjeto.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // SUBTOTAL EXENTO DE IVA
  doc.text("SUBTOTAL EXENTO DE IVA", rightX + 5, yPos);
  doc.text(`$${subtotalExento.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // SUBTOTAL SIN IMPUESTOS
  doc.text("SUBTOTAL SIN IMPUESTOS", rightX + 5, yPos);
  doc.text(`$${subtotal15.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // DESCUENTO
  doc.text("DESCUENTO", rightX + 5, yPos);
  doc.text(`$${descuentoTotal.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // ICE
  doc.text("ICE", rightX + 5, yPos);
  doc.text("$0.00", rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // IVA 15%
  doc.text("IVA 15%", rightX + 5, yPos);
  doc.text(`$${venta.iva_total.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // IRBPNR
  doc.text("IRBPNR", rightX + 5, yPos);
  doc.text("$0.00", rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 12;

  // PROPINA
  doc.text("PROPINA", rightX + 5, yPos);
  doc.text("$0.00", rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });
  yPos += 15;

  // VALOR TOTAL
  doc.fontSize(11).font("Helvetica-Bold");
  doc.text("VALOR TOTAL", rightX + 5, yPos);
  doc.text(`$${venta.total.toFixed(2)}`, rightX + rightWidth - 60, yPos, {
    align: "right",
    width: 50,
  });

  doc.y = yStart + 190;
}

/**
 * Generar pie de página
 */
function generarPiePaginaPDF(doc, venta) {
  const pageHeight = doc.page.height;
  const pageWidth = doc.page.width - 80;
  const yPos = pageHeight - 80;

  // Línea separadora
  doc
    .moveTo(40, yPos - 10)
    .lineTo(40 + pageWidth, yPos - 10)
    .stroke();

  // Información del sistema
  doc.fontSize(7).font("Helvetica");
  doc.text(`Generado por: ${venta.usuarios.nombre_completo}`, 40, yPos);
  doc.text(
    `Fecha y hora de generación: ${new Date().toLocaleString("es-ES")}`,
    40,
    yPos + 10
  );

  // Mensaje de validación
  doc.text("Documento generado automáticamente", 40, yPos + 65, {
    width: pageWidth,
    align: "center",
  });
}

/**
 * Formatear forma de pago para mostrar
 */
function formatearFormaPago(formaPago) {
  const mapeo = {
    efectivo: "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
    tarjeta_credito: "TARJETA DE CRÉDITO",
    tarjeta_debito: "TARJETA DE DÉBITO",
    transferencia: "TRANSFERENCIA BANCARIA",
    deposito: "DEPÓSITO BANCARIO",
    cheque: "CHEQUE",
    credito: "CRÉDITO",
  };

  return mapeo[formaPago] || formaPago.toUpperCase();
}
