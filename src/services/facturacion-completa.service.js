/**
 * Servicio mejorado para el procesamiento completo de facturas SRI
 * Integra ambiente dinámico, validaciones y procesamientos optimizados
 */

import { obtenerConfiguracionAmbienteSRI, validarCertificado } from './ambiente-sri.service.js';
import { generarFacturaElectronica, firmarXml, enviarDocumentoRecepcion, solicitarAutorizacion } from './facturacion-electronica.service.js';
import { getConnection } from '../database/connection.js';

/**
 * Procesa una factura electrónica de forma completa
 * @param {Object} datosFactura - Datos de la factura a procesar
 * @returns {Object} Resultado completo del procesamiento
 */
export async function procesarFacturaElectronicaCompleta(datosFactura) {
  try {
    console.log('🚀 === INICIANDO PROCESAMIENTO COMPLETO DE FACTURA SRI === 🚀');
    
    // PASO 1: Obtener configuración de ambiente desde BD
    const configuracionAmbiente = await obtenerConfiguracionAmbienteSRI();
    console.log(`📡 Ambiente configurado: ${configuracionAmbiente.ambiente} (${configuracionAmbiente.ambienteNumerico})`);
    
    // PASO 2: Validar certificado
    const estadoCertificado = validarCertificado(configuracionAmbiente);
    if (!estadoCertificado.valido) {
      throw new Error(`Certificado no válido: ${estadoCertificado.error || estadoCertificado.critico}`);
    }
    console.log(`✅ Certificado válido (vence en ${estadoCertificado.diasParaVencer} días)`);
    
    // PASO 3: Preparar configuración de factura con ambiente correcto
    const facturaConfig = {
      ...datosFactura,
      infoTributaria: {
        ...datosFactura.infoTributaria,
        ambiente: configuracionAmbiente.ambienteNumerico // Usar ambiente de BD
      }
    };
    
    // PASO 4: Generar factura electrónica
    console.log('📋 Generando estructura de factura...');
    const resultadoFactura = await generarFacturaElectronica(facturaConfig);
    const { claveAcceso, factura, xmlSinFirmar } = resultadoFactura;
    
    console.log(`✅ Factura generada con clave: ${claveAcceso}`);
    
    // PASO 5: Firmar XML
    console.log('🔐 Firmando XML con certificado...');
    const xmlFirmado = await firmarXml(
      xmlSinFirmar, 
      configuracionAmbiente.certificado.path, 
      configuracionAmbiente.certificado.password
    );
    console.log('✅ XML firmado exitosamente');
    
    // PASO 6: Enviar para recepción al SRI
    console.log(`📤 Enviando al SRI (recepción) - Ambiente: ${configuracionAmbiente.ambiente}`);
    const resultadoRecepcion = await enviarDocumentoRecepcion(xmlFirmado, configuracionAmbiente.ambiente);
    console.log('📬 Respuesta de recepción:', JSON.stringify(resultadoRecepcion, null, 2));
    
    // PASO 7: Verificar recepción exitosa
    if (!resultadoRecepcion || (resultadoRecepcion.estado !== "RECIBIDA" && resultadoRecepcion.comprobante !== "RECIBIDA")) {
      return {
        success: false,
        estado: 'RECHAZADA_RECEPCION',
        mensaje: 'Documento rechazado en recepción por el SRI',
        detalles: resultadoRecepcion?.mensajes || resultadoRecepcion?.informacionAdicional || ['Error desconocido'],
        claveAcceso,
        xmlGenerado: xmlSinFirmar,
        xmlFirmado
      };
    }
    
    // PASO 8: Esperar y solicitar autorización
    console.log('⏳ Esperando procesamiento del SRI antes de solicitar autorización...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Esperar 3 segundos
    
    console.log('🔍 Solicitando autorización...');
    const resultadoAutorizacion = await solicitarAutorizacion(claveAcceso, configuracionAmbiente.ambiente);
    console.log('📬 Respuesta de autorización:', JSON.stringify(resultadoAutorizacion, null, 2));
    
    // PASO 9: Determinar estado final
    let estadoFinal = 'PROCESANDO';
    let numeroAutorizacion = claveAcceso;
    let xmlAutorizado = xmlFirmado;
    
    if (resultadoAutorizacion && (resultadoAutorizacion.estado === "AUTORIZADO" || resultadoAutorizacion.comprobante === "AUTORIZADA")) {
      estadoFinal = 'AUTORIZADA';
      numeroAutorizacion = resultadoAutorizacion.numeroAutorizacion || resultadoAutorizacion.claveAcceso || claveAcceso;
      xmlAutorizado = resultadoAutorizacion.comprobante || xmlFirmado;
      console.log('🎉 Factura AUTORIZADA exitosamente por el SRI');
    } else if (resultadoAutorizacion && resultadoAutorizacion.estado === "EN_PROCESAMIENTO") {
      estadoFinal = 'PROCESANDO';
      console.log('⏳ Factura en procesamiento por el SRI');
    } else {
      estadoFinal = 'RECHAZADA_AUTORIZACION';
      console.log('❌ Factura rechazada en autorización');
    }
    
    // PASO 10: Retornar resultado completo
    return {
      success: estadoFinal === 'AUTORIZADA' || estadoFinal === 'PROCESANDO',
      estado: estadoFinal,
      mensaje: estadoFinal === 'AUTORIZADA' ? 'Factura autorizada exitosamente' : 
               estadoFinal === 'PROCESANDO' ? 'Factura en procesamiento' : 'Factura rechazada',
      claveAcceso,
      numeroAutorizacion,
      ambiente: configuracionAmbiente.ambiente,
      ambienteNumerico: configuracionAmbiente.ambienteNumerico,
      xmlGenerado: xmlSinFirmar,
      xmlFirmado,
      xmlAutorizado,
      recepcion: resultadoRecepcion,
      autorizacion: resultadoAutorizacion,
      configuracionUsada: {
        ambiente: configuracionAmbiente.ambiente,
        urls: configuracionAmbiente.urls,
        certificadoValido: estadoCertificado.valido
      }
    };
    
  } catch (error) {
    console.error('❌ Error en procesamiento completo:', error);
    return {
      success: false,
      estado: 'ERROR',
      mensaje: `Error en procesamiento: ${error.message}`,
      error: error.stack
    };
  }
}

/**
 * Guarda una factura en la base de datos con todos los campos necesarios
 * @param {Object} resultadoProcesamiento - Resultado del procesamiento completo
 * @param {Object} datosAdicionales - Datos adicionales de la factura
 * @returns {Object} Factura guardada
 */
export async function guardarFacturaEnBD(resultadoProcesamiento, datosAdicionales) {
  try {
    const supabase = await getConnection();
    if (!supabase) {
      throw new Error("No se pudo conectar a la base de datos");
    }
    
    // Mapear estado para BD
    const estadoBD = resultadoProcesamiento.estado === 'AUTORIZADA' ? 'A' :
                     resultadoProcesamiento.estado === 'PROCESANDO' ? 'E' :
                     resultadoProcesamiento.estado === 'RECHAZADA_RECEPCION' || 
                     resultadoProcesamiento.estado === 'RECHAZADA_AUTORIZACION' ? 'R' : 'X';
    
    // Preparar datos para insertar
    const facturaData = {
      id_emisor: datosAdicionales.id_emisor,
      id_cliente: datosAdicionales.id_cliente,
      id_usuario: datosAdicionales.id_usuario,
      clave_acceso: resultadoProcesamiento.claveAcceso,
      numero_secuencial: datosAdicionales.numero_secuencial,
      fecha_emision: datosAdicionales.fecha_emision,
      estado: estadoBD,
      ambiente_sri: resultadoProcesamiento.ambiente,
      numero_autorizacion: resultadoProcesamiento.numeroAutorizacion,
      xml_autorizado: resultadoProcesamiento.xmlAutorizado,
      punto_emision: datosAdicionales.punto_emision,
      subtotal: datosAdicionales.subtotal,
      iva_total: datosAdicionales.iva_total,
      total: datosAdicionales.total
    };
    
    if (resultadoProcesamiento.estado === 'AUTORIZADA') {
      facturaData.fecha_autorizacion = new Date().toISOString();
    }
    
    // Insertar factura
    const { data: facturaGuardada, error: errorFactura } = await supabase
      .from('factura_electronica')
      .insert([facturaData])
      .select()
      .single();
    
    if (errorFactura) {
      throw new Error(`Error guardando factura: ${errorFactura.message}`);
    }
    
    // Guardar detalles si existen
    if (datosAdicionales.detalles && datosAdicionales.detalles.length > 0) {
      const detallesData = datosAdicionales.detalles.map(detalle => ({
        id_factura: facturaGuardada.id_factura,
        id_producto: detalle.id_producto,
        descripcion: detalle.descripcion,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal,
        valor_iva: detalle.valor_iva,
        total: detalle.total,
        tasa_iva: detalle.tasa_iva,
        descuento: detalle.descuento || 0
      }));
      
      const { error: errorDetalles } = await supabase
        .from('detalle_factura')
        .insert(detallesData);
      
      if (errorDetalles) {
        console.warn('⚠️ Error guardando detalles:', errorDetalles.message);
      }
    }
    
    // Guardar formas de pago si existen
    if (datosAdicionales.formas_pago && datosAdicionales.formas_pago.length > 0) {
      const pagosData = datosAdicionales.formas_pago.map(pago => ({
        id_factura: facturaGuardada.id_factura,
        forma_pago: pago.forma_pago,
        valor_pago: pago.valor_pago,
        plazo: pago.plazo,
        unidad_tiempo: pago.unidad_tiempo
      }));
      
      const { error: errorPagos } = await supabase
        .from('forma_pago_factura')
        .insert(pagosData);
      
      if (errorPagos) {
        console.warn('⚠️ Error guardando formas de pago:', errorPagos.message);
      }
    }
    
    // Guardar información adicional si existe
    if (datosAdicionales.info_adicional && datosAdicionales.info_adicional.length > 0) {
      const infoAdicionalData = datosAdicionales.info_adicional.map(info => ({
        id_factura: facturaGuardada.id_factura,
        nombre: info.nombre,
        descripcion: info.descripcion
      }));
      
      const { error: errorInfo } = await supabase
        .from('info_adicional_factura')
        .insert(infoAdicionalData);
      
      if (errorInfo) {
        console.warn('⚠️ Error guardando información adicional:', errorInfo.message);
      }
    }
    
    console.log(`✅ Factura guardada en BD con ID: ${facturaGuardada.id_factura}`);
    return facturaGuardada;
    
  } catch (error) {
    console.error('❌ Error guardando factura en BD:', error);
    throw new Error(`Error guardando factura: ${error.message}`);
  }
}

/**
 * Consulta el estado de una factura en el SRI
 * @param {string} claveAcceso - Clave de acceso de la factura
 * @returns {Object} Estado actual de la factura en el SRI
 */
export async function consultarEstadoFactura(claveAcceso) {
  try {
    const configuracionAmbiente = await obtenerConfiguracionAmbienteSRI();
    const resultado = await solicitarAutorizacion(claveAcceso, configuracionAmbiente.ambiente);
    
    return {
      success: true,
      claveAcceso,
      estado: resultado?.estado || 'DESCONOCIDO',
      numeroAutorizacion: resultado?.numeroAutorizacion,
      fechaAutorizacion: resultado?.fechaAutorizacion,
      ambiente: configuracionAmbiente.ambiente,
      detalles: resultado
    };
  } catch (error) {
    return {
      success: false,
      claveAcceso,
      error: error.message
    };
  }
}
