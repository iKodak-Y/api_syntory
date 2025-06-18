import { getConnection } from "../database/connection.js";
import {
  generarNumeroSecuencial,
  calcularTotales,
  validarStock,
  actualizarStock,
  generarPDFVenta
} from "../services/ventas.service.js";
import EmailService from "../services/email.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Obtener la ruta base del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Función auxiliar para registrar errores en la base de datos
 */
const registrarError = async (id_venta, descripcion) => {
  try {
    const supabase = await getConnection();
    await supabase
      .from("log_errores_venta")
      .insert({
        id_venta,
        descripcion
      });
    console.log("Error registrado en log:", descripcion);
  } catch (logError) {
    console.error("Error registrando log de error:", logError);
  }
};

/**
 * Obtener todas las ventas
 */
export const getVentas = async (req, res) => {
  try {
    console.log("=== OBTENER VENTAS ===");
    
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          id_cliente,
          nombre,
          apellido,
          cedula_ruc
        ),
        usuarios(
          id_usuario,
          nombre_completo
        ),
        emisor(
          id_emisor,
          razon_social
        )
      `)
      .order("fecha_registro", { ascending: false });

    if (error) {
      console.error("Error obteniendo ventas:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
        details: error.message
      });
    }

    console.log(`Ventas obtenidas: ${data?.length || 0}`);
    
    res.json({
      success: true,
      message: "Ventas obtenidas exitosamente",
      data: data || []
    });
  } catch (error) {
    console.error("Error en getVentas:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      details: error.message
    });
  }
};

/**
 * Obtener una venta por ID
 */
export const getVenta = async (req, res) => {
  try {
    console.log("=== OBTENER VENTA ===");
    console.log("ID de venta:", req.params.id);

    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          id_cliente,
          nombre,
          apellido,
          cedula_ruc,
          direccion,
          telefono,
          email
        ),
        usuarios(
          id_usuario,
          nombre_completo
        ),
        emisor(
          id_emisor,
          ruc,
          razon_social,
          nombre_comercial,
          direccion,
          logo
        ),
        detalle_venta(
          id_detalle,
          id_producto,
          descripcion,
          cantidad,
          precio_unitario,
          subtotal,
          valor_iva,
          total,
          tasa_iva,
          descuento,
          productos(
            id_producto,
            codigo,
            nombre
          )
        ),
        forma_pago_venta(
          id_pago,
          forma_pago,
          valor_pago,
          plazo,
          unidad_tiempo
        ),
        info_adicional_venta(
          id_info_adicional,
          nombre,
          descripcion
        )
      `)
      .eq("id_venta", req.params.id)
      .single();

    if (error) {
      console.error("Error obteniendo venta:", error);
      return res.status(500).json({
        success: false,
        message: "Error interno del servidor",
        details: error.message
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada"
      });
    }

    console.log("Venta obtenida exitosamente");
    
    res.json({
      success: true,
      message: "Venta obtenida exitosamente",
      data
    });
  } catch (error) {
    console.error("Error en getVenta:", error);
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      details: error.message
    });
  }
};

/**
 * Crear una nueva venta
 */
export const createVenta = async (req, res) => {
  try {
    console.log("=== INICIO CREACIÓN VENTA ===");
    console.log("Datos recibidos:", JSON.stringify(req.body, null, 2));

    // Extraer datos necesarios
    const {
      id_emisor,
      id_cliente,
      id_usuario,
      punto_emision,
      detalles,
      formas_pago,
      info_adicional,
      fecha_emision
    } = req.body;

    // Validaciones básicas
    if (!id_emisor || !id_usuario || !punto_emision || !detalles || !formas_pago) {
      return res.status(400).json({
        success: false,
        message: "Datos incompletos para crear venta",
        campos_requeridos: ["id_emisor", "id_usuario", "punto_emision", "detalles", "formas_pago"]
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

    // Validar cliente si se proporciona
    if (id_cliente) {
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
    }

    // Validar stock de productos
    console.log("Validando stock de productos...");
    const stockValido = await validarStock(detalles);
    if (!stockValido.valido) {
      return res.status(400).json({
        success: false,
        message: "Stock insuficiente",
        detalles: stockValido.errores
      });
    }

    // Generar número secuencial
    const numeroSecuencial = await generarNumeroSecuencial(punto_emision);
    console.log("Número secuencial generado:", numeroSecuencial);

    // Calcular totales
    const totales = calcularTotales(detalles);
    console.log("Totales calculados:", totales);

    // Validar que los totales de formas de pago coincidan
    const totalFormasPago = formas_pago.reduce((sum, pago) => sum + parseFloat(pago.valor_pago), 0);
    if (Math.abs(totalFormasPago - totales.total) > 0.01) {
      return res.status(400).json({
        success: false,
        message: "El total de las formas de pago no coincide con el total de la venta",
        detalles: {
          total_venta: totales.total,
          total_pagos: totalFormasPago,
          diferencia: Math.abs(totalFormasPago - totales.total)
        }
      });
    }    // Iniciar transacción - Crear venta principal
    console.log("Creando venta principal...");
    const { data: ventaData, error: ventaError } = await supabase
      .from("ventas")
      .insert({
        id_emisor,
        id_cliente: id_cliente || null,
        id_usuario,
        numero_secuencial: numeroSecuencial,
        fecha_emision: fecha_emision || new Date().toISOString().split('T')[0],
        estado: 'P',
        punto_emision,
        subtotal: totales.subtotal,
        iva_total: totales.iva_total,
        total: totales.total
      })
      .select()
      .single();

    if (ventaError) {
      console.error("Error creando venta:", ventaError);
      return res.status(500).json({
        success: false,
        message: "Error creando venta",
        details: ventaError.message
      });
    }

    const id_venta = ventaData.id_venta;
    console.log("Venta creada con ID:", id_venta);

    // Insertar detalles de venta
    console.log("Insertando detalles de venta...");
    const detallesConId = detalles.map(detalle => ({
      id_venta,
      id_producto: detalle.id_producto,
      descripcion: detalle.descripcion,
      cantidad: parseFloat(detalle.cantidad),
      precio_unitario: parseFloat(detalle.precio_unitario),
      subtotal: parseFloat(detalle.subtotal),
      valor_iva: parseFloat(detalle.valor_iva),
      total: parseFloat(detalle.total),
      tasa_iva: parseFloat(detalle.tasa_iva || 0.15),
      descuento: parseFloat(detalle.descuento || 0)
    }));

    const { error: detallesError } = await supabase
      .from("detalle_venta")
      .insert(detallesConId);

    if (detallesError) {
      console.error("Error insertando detalles:", detallesError);
      // Registrar error y limpiar
      await registrarError(id_venta, `Error insertando detalles: ${detallesError.message}`);
      return res.status(500).json({
        success: false,
        message: "Error insertando detalles de venta",
        details: detallesError.message
      });
    }

    // Insertar formas de pago
    console.log("Insertando formas de pago...");
    const formasPagoConId = formas_pago.map(pago => ({
      id_venta,
      forma_pago: pago.forma_pago,
      valor_pago: parseFloat(pago.valor_pago),
      plazo: pago.plazo || null,
      unidad_tiempo: pago.unidad_tiempo || null
    }));

    const { error: pagosError } = await supabase
      .from("forma_pago_venta")
      .insert(formasPagoConId);

    if (pagosError) {
      console.error("Error insertando formas de pago:", pagosError);
      await registrarError(id_venta, `Error insertando formas de pago: ${pagosError.message}`);
      return res.status(500).json({
        success: false,
        message: "Error insertando formas de pago",
        details: pagosError.message
      });
    }

    // Insertar información adicional si existe
    if (info_adicional && Array.isArray(info_adicional) && info_adicional.length > 0) {
      console.log("Insertando información adicional...");
      const infoAdicionalConId = info_adicional.map(info => ({
        id_venta,
        nombre: info.nombre,
        descripcion: info.descripcion
      }));

      const { error: infoError } = await supabase
        .from("info_adicional_venta")
        .insert(infoAdicionalConId);

      if (infoError) {
        console.error("Error insertando información adicional:", infoError);
        await registrarError(id_venta, `Error insertando información adicional: ${infoError.message}`);
        // No falla la transacción por información adicional
      }
    }

    // Actualizar stock de productos
    console.log("Actualizando stock...");
    try {
      await actualizarStock(detalles);
    } catch (stockError) {
      console.error("Error actualizando stock:", stockError);
      await registrarError(id_venta, `Error actualizando stock: ${stockError.message}`);
      return res.status(500).json({
        success: false,
        message: "Error actualizando stock de productos",
        details: stockError.message
      });
    }

    // Actualizar estado de la venta a emitida
    console.log("Actualizando estado de venta...");
    const { error: updateError } = await supabase
      .from("ventas")
      .update({ estado: 'E' })
      .eq("id_venta", id_venta);

    if (updateError) {
      console.error("Error actualizando estado:", updateError);
      await registrarError(id_venta, `Error actualizando estado: ${updateError.message}`);
      return res.status(500).json({
        success: false,
        message: "Error actualizando estado de venta",
        details: updateError.message
      });
    }    // Generar PDF
    console.log("Generando PDF...");
    try {
      const pdfPath = await generarPDFVenta(id_venta);
      
      // Actualizar la venta con la ruta del PDF
      await supabase
        .from("ventas")
        .update({ pdf_path: pdfPath })
        .eq("id_venta", id_venta);

      console.log("PDF generado:", pdfPath);
    } catch (pdfError) {
      console.error("Error generando PDF:", pdfError);
      await registrarError(id_venta, `Error generando PDF: ${pdfError.message}`);
      // No fallar la transacción por el PDF, es opcional
    }

    // Obtener la venta completa creada
    console.log("Obteniendo venta completa...");
    const { data: ventaCompleta, error: ventaCompletaError } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          id_cliente,
          nombre,
          apellido,
          cedula_ruc,
          direccion,
          telefono,
          email
        ),
        usuarios(
          id_usuario,
          nombre_completo
        ),
        emisor(
          id_emisor,
          ruc,
          razon_social,
          nombre_comercial
        ),
        detalle_venta(
          id_detalle,
          id_producto,
          descripcion,
          cantidad,
          precio_unitario,
          subtotal,
          valor_iva,
          total,
          tasa_iva,
          descuento,
          productos(
            id_producto,
            codigo,
            nombre
          )
        ),
        forma_pago_venta(
          id_pago,
          forma_pago,
          valor_pago,
          plazo,
          unidad_tiempo
        ),
        info_adicional_venta(
          id_info_adicional,
          nombre,
          descripcion
        )
      `)
      .eq("id_venta", id_venta)
      .single();

    if (ventaCompletaError) {
      console.error("Error obteniendo venta completa:", ventaCompletaError);
      // Aún así, la venta se creó exitosamente
    }    console.log("=== VENTA CREADA EXITOSAMENTE ===");
    
    // Enviar PDF por email al cliente (si tiene email)
    if (ventaCompleta && ventaCompleta.clientes && ventaCompleta.clientes.email && ventaCompleta.pdf_path) {
      console.log("Enviando PDF por email al cliente...");
      try {
        const emailService = new EmailService();
        
        // Preparar datos para el email
        const emailData = {
          cliente_email: ventaCompleta.clientes.email,
          cliente_nombre: `${ventaCompleta.clientes.nombre} ${ventaCompleta.clientes.apellido || ''}`.trim(),
          numero_secuencial: ventaCompleta.numero_secuencial,
          fecha_emision: ventaCompleta.fecha_emision,
          total: ventaCompleta.total,
          emisor_razon_social: ventaCompleta.emisor.razon_social,
          emisor_ruc: ventaCompleta.emisor.ruc,
          emisor_direccion: ventaCompleta.emisor.direccion || '',
          pdf_url: ventaCompleta.pdf_path
        };
        
        const emailResult = await emailService.enviarPDFVenta(emailData);
        
        if (emailResult.success) {
          console.log("PDF enviado por email exitosamente");
        } else {
          console.log("No se pudo enviar el PDF por email:", emailResult.message);
          // Registrar como warning pero no fallar la venta
          await registrarError(id_venta, `Warning - Email no enviado: ${emailResult.message}`);
        }
        
      } catch (emailError) {
        console.error("Error enviando email:", emailError);
        await registrarError(id_venta, `Error enviando email: ${emailError.message}`);
        // No fallar la venta por error de email
      }
    } else {
      console.log("No se enviará email: cliente sin email o PDF no generado");
    }
    
    res.status(201).json({
      success: true,
      message: "Venta creada exitosamente",
      data: ventaCompleta || { id_venta, numero_secuencial: numeroSecuencial }
    });

  } catch (error) {
    console.error("Error crítico creando venta:", error);
    
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      details: error.message
    });
  }
};

/**
 * Actualizar estado de una venta
 */
export const updateVentaEstado = async (req, res) => {
  try {
    const { estado } = req.body;
    const supabase = await getConnection();

    const { data, error } = await supabase
      .from("ventas")
      .update({ estado })
      .eq("id_venta", req.params.id)
      .select()
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    res.json({
      success: true,
      message: "Estado actualizado exitosamente",
      data
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Anular una venta
 */
export const anularVenta = async (req, res) => {
  try {
    const { motivo } = req.body;
    
    if (!motivo) {
      return res.status(400).json({
        success: false,
        message: "El motivo de anulación es requerido"
      });
    }

    const supabase = await getConnection();

    // Obtener la venta actual
    const { data: venta, error: ventaError } = await supabase
      .from("ventas")
      .select("*, detalle_venta(*)")
      .eq("id_venta", req.params.id)
      .single();

    if (ventaError) throw ventaError;
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    if (venta.estado === 'N') {
      return res.status(400).json({
        success: false,
        message: "La venta ya está anulada"
      });
    }

    // Devolver stock a productos
    for (const detalle of venta.detalle_venta) {
      const { error: stockError } = await supabase
        .from("productos")
        .update({
          stock_actual: supabase.raw('stock_actual + ?', [detalle.cantidad])
        })
        .eq("id_producto", detalle.id_producto);

      if (stockError) throw stockError;
    }

    // Actualizar estado de la venta
    const { data, error } = await supabase
      .from("ventas")
      .update({ estado: 'N' })
      .eq("id_venta", req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Registrar log de anulación
    await supabase
      .from("log_errores_venta")
      .insert({
        id_venta: req.params.id,
        descripcion: `Venta anulada. Motivo: ${motivo}`
      });

    res.json({
      success: true,
      message: "Venta anulada exitosamente",
      data
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Descargar PDF de una venta
 */
export const descargarPDFVenta = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*")
      .eq("id_venta", req.params.id)
      .single();

    if (error) throw error;
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    let pdfUrl = venta.pdf_path;

    // Si no tiene PDF, generarlo
    if (!pdfUrl) {
      pdfUrl = await generarPDFVenta(req.params.id);
      
      // Actualizar la venta con la URL del PDF
      await supabase
        .from("ventas")
        .update({ pdf_path: pdfUrl })
        .eq("id_venta", req.params.id);
    }

    // Redirigir a la URL de Supabase Storage para descarga
    res.redirect(pdfUrl);

  } catch (error) {
    console.error("Error descargando PDF:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message
    });
  }
};

/**
 * Ver PDF de una venta en el navegador
 */
export const verPDFVenta = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    const { data: venta, error } = await supabase
      .from("ventas")
      .select("*")
      .eq("id_venta", req.params.id)
      .single();

    if (error) throw error;
    if (!venta) {
      return res.status(404).json({ message: "Venta no encontrada" });
    }

    let pdfUrl = venta.pdf_path;

    // Si no tiene PDF, generarlo
    if (!pdfUrl) {
      pdfUrl = await generarPDFVenta(req.params.id);
      
      // Actualizar la venta con la URL del PDF
      await supabase
        .from("ventas")
        .update({ pdf_path: pdfUrl })
        .eq("id_venta", req.params.id);
    }

    // Redirigir a la URL de Supabase Storage para visualización
    res.redirect(pdfUrl);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Generar PDF de una venta
 */
export const generarPDF = async (req, res) => {
  try {
    const pdfUrl = await generarPDFVenta(req.params.id);
    
    // Actualizar la venta con la URL del PDF
    const supabase = await getConnection();
    await supabase
      .from("ventas")
      .update({ pdf_path: pdfUrl })
      .eq("id_venta", req.params.id);

    res.json({
      success: true,
      message: "PDF generado exitosamente",
      url: pdfUrl
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Obtener resumen de ventas
 */
export const getVentasResumen = async (req, res) => {
  try {
    const supabase = await getConnection();
    
    // Obtener totales del día actual
    const hoy = new Date().toISOString().split('T')[0];
    
    const { data: ventasHoy, error: ventasHoyError } = await supabase
      .from("ventas")
      .select("total")
      .eq("fecha_emision", hoy)
      .eq("estado", "E");

    if (ventasHoyError) throw ventasHoyError;

    const totalHoy = ventasHoy.reduce((sum, venta) => sum + parseFloat(venta.total), 0);
    const cantidadVentasHoy = ventasHoy.length;

    // Obtener ventas pendientes
    const { data: ventasPendientes, error: pendientesError } = await supabase
      .from("ventas")
      .select("id_venta")
      .eq("estado", "P");

    if (pendientesError) throw pendientesError;

    res.json({
      total_ventas_hoy: totalHoy,
      cantidad_ventas_hoy: cantidadVentasHoy,
      ventas_pendientes: ventasPendientes.length
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Obtener el siguiente número secuencial para ventas
 */
export const getSiguienteSecuencial = async (req, res) => {
  try {
    console.log("=== OBTENER SIGUIENTE SECUENCIAL ===");
    
    const { id_emisor, punto_emision } = req.params;
    
    console.log("Parámetros recibidos:", { id_emisor, punto_emision });
    
    // Validar parámetros
    if (!id_emisor || !punto_emision) {
      return res.status(400).json({
        message: "Los parámetros id_emisor y punto_emision son obligatorios"
      });
    }
    
    const supabase = await getConnection();
    
    // Consultar el último número secuencial en la tabla ventas
    const { data, error } = await supabase
      .from("ventas")
      .select("numero_secuencial")
      .eq("id_emisor", id_emisor)
      .eq("punto_emision", punto_emision)
      .order("numero_secuencial", { ascending: false })
      .limit(1);
    
    if (error) {
      console.error("Error al consultar secuencial:", error);
      throw error;
    }
    
    let siguienteSecuencial;
    
    if (data && data.length > 0) {
      // Existe al menos una venta, incrementar el secuencial
      const ultimoSecuencial = parseInt(data[0].numero_secuencial) || 0;
      siguienteSecuencial = ultimoSecuencial + 1;
    } else {
      // No existen ventas para este emisor y punto de emisión, empezar en 1
      siguienteSecuencial = 1;
    }
    
    // Formatear el secuencial con 9 dígitos con ceros a la izquierda
    const secuencialFormateado = siguienteSecuencial.toString().padStart(9, '0');
    
    console.log("Siguiente secuencial calculado:", secuencialFormateado);
    
    res.json({
      secuencial: secuencialFormateado
    });
    
  } catch (error) {
    console.error("Error obteniendo siguiente secuencial:", error);
    res.status(500).json({
      message: "Error al obtener el siguiente secuencial",
      details: error.message
    });
  }
};

/**
 * Probar configuración de email
 */
export const probarEmail = async (req, res) => {
  try {
    const emailService = new EmailService();
    const resultado = await emailService.probarConfiguracion();
    
    res.json(resultado);
  } catch (error) {
    console.error("Error probando configuración de email:", error);
    res.status(500).json({
      success: false,
      message: "Error probando configuración de email",
      details: error.message
    });
  }
};

/**
 * Reenviar PDF por email
 */
export const reenviarEmail = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();
    
    // Obtener venta completa
    const { data: venta, error } = await supabase
      .from("ventas")
      .select(`
        *,
        clientes(
          email,
          nombre,
          apellido
        ),
        emisor(
          ruc,
          razon_social,
          direccion
        )
      `)
      .eq("id_venta", id)
      .single();

    if (error || !venta) {
      return res.status(404).json({
        success: false,
        message: "Venta no encontrada"
      });
    }

    if (!venta.clientes || !venta.clientes.email) {
      return res.status(400).json({
        success: false,
        message: "El cliente no tiene email registrado"
      });
    }

    if (!venta.pdf_path) {
      return res.status(400).json({
        success: false,
        message: "La venta no tiene PDF generado"
      });
    }

    // Enviar email
    const emailService = new EmailService();
    const emailData = {
      cliente_email: venta.clientes.email,
      cliente_nombre: `${venta.clientes.nombre} ${venta.clientes.apellido || ''}`.trim(),
      numero_secuencial: venta.numero_secuencial,
      fecha_emision: venta.fecha_emision,
      total: venta.total,
      emisor_razon_social: venta.emisor.razon_social,
      emisor_ruc: venta.emisor.ruc,
      emisor_direccion: venta.emisor.direccion || '',
      pdf_url: venta.pdf_path
    };

    const resultado = await emailService.enviarPDFVenta(emailData);
    
    res.json(resultado);

  } catch (error) {
    console.error("Error reenviando email:", error);
    res.status(500).json({
      success: false,
      message: "Error reenviando email",
      details: error.message
    });
  }
};

/**
 * Endpoint de prueba para generar PDF con datos simulados
 */
export const testPDF = async (req, res) => {
  try {
    console.log("=== PROBANDO GENERACIÓN PDF ===");
    
    // Datos simulados para prueba (basados en la imagen SRI)
    const ventaSimulada = {
      id_venta: 999,
      numero_secuencial: "000000103",
      punto_emision: "002",
      fecha_emision: new Date().toISOString(),
      subtotal: 134.78,
      iva_total: 20.22,
      total: 155.00,
      estado: "completada",
      emisor: {
        id_emisor: 1,
        ruc: "2450646365001",
        razon_social: "KODAKA YAGUAL IMIRSKY KHHABET",
        nombre_comercial: "K-TECH",
        direccion: "Barrio MARISCAL SUCRE Calle: GUAYAQUIL Número: Matriz: S/N Intersección: AV 4A",
        logo: null
      },
      clientes: {
        id_cliente: 1,
        nombre: "FRANCO PARRALES",
        apellido: "WILSON GUILLERMO",
        cedula_ruc: "0527606259",
        direccion: "Guayaquil, Ecuador",
        telefono: "0939442993",
        email: "francoparrales@gmail.com",
        tipo_identificacion: "cedula"
      },
      usuarios: {
        nombre_completo: "Usuario de Prueba"
      },
      detalle_venta: [
        {
          descripcion: "INFINIX HOT 50L",
          cantidad: 1,
          precio_unitario: 130.43,
          subtotal: 130.43,
          valor_iva: 19.56,
          total: 149.99,
          tasa_iva: 0.15,
          descuento: 0
        },
        {
          descripcion: "CHIP CLARO",
          cantidad: 1,
          precio_unitario: 4.35,
          subtotal: 4.35,
          valor_iva: 0.65,
          total: 5.00,
          tasa_iva: 0.15,
          descuento: 0
        }
      ],
      forma_pago_venta: [
        {
          forma_pago: "efectivo",
          valor_pago: 155.00
        }
      ],
      info_adicional_venta: [
        {
          nombre: "Teléfono",
          descripcion: "0939442993"
        },
        {
          nombre: "Email",
          descripcion: "francoparrales@gmail.com"
        }
      ]
    };

    // Importar el servicio de PDF
    const { generarPDFDirecto } = await import("../services/ventas.service.js");
    
    // Generar el PDF usando datos simulados
    const pdfUrl = await generarPDFDirecto(ventaSimulada);
    
    res.json({
      success: true,
      message: "PDF de prueba generado exitosamente",
      pdf_url: pdfUrl,
      venta_test: {
        id: ventaSimulada.id_venta,
        numero: `${ventaSimulada.punto_emision}-${ventaSimulada.numero_secuencial}`,
        total: ventaSimulada.total
      }
    });

  } catch (error) {
    console.error("Error en prueba de PDF:", error);
    res.status(500).json({
      success: false,
      message: "Error generando PDF de prueba",
      error: error.message
    });
  }
};
