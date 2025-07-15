/**
 * Controlador mejorado para facturación electrónica SRI
 * Usa configuración de ambiente desde la base de datos y procesamientos optimizados
 */

import { procesarFacturaElectronicaCompleta, guardarFacturaEnBD, consultarEstadoFactura } from '../services/facturacion-completa.service.js';
import { obtenerConfiguracionAmbienteSRI, cambiarAmbienteSRI, obtenerEstadoSistema } from '../services/ambiente-sri.service.js';
import { getConnection } from '../database/connection.js';

/**
 * Emite una factura electrónica completa
 */
export const emitirFacturaElectronica = async (req, res) => {
  try {
    console.log('🚀 === NUEVA SOLICITUD DE FACTURA ELECTRÓNICA === 🚀');
    console.log('📋 Datos recibidos:', JSON.stringify(req.body, null, 2));
    
    const {
      id_emisor,
      id_cliente,
      id_usuario,
      numero_secuencial,
      fecha_emision,
      punto_emision,
      detalles,
      formas_pago,
      info_adicional,
      subtotal,
      iva_total,
      total
    } = req.body;
    
    // Validaciones básicas
    if (!id_emisor || !id_usuario || !numero_secuencial || !detalles || detalles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos requeridos para la factura",
        detallesRequeridos: ["id_emisor", "id_usuario", "numero_secuencial", "detalles"]
      });
    }
    
    // Obtener datos del emisor y cliente
    const supabase = await getConnection();
    
    const { data: emisor, error: errorEmisor } = await supabase
      .from('emisor')
      .select('*')
      .eq('id_emisor', id_emisor)
      .single();
    
    if (errorEmisor || !emisor) {
      return res.status(404).json({
        success: false,
        message: "Emisor no encontrado",
        details: errorEmisor?.message
      });
    }
    
    let cliente = null;
    if (id_cliente) {
      const { data: clienteData, error: errorCliente } = await supabase
        .from('clientes')
        .select('*')
        .eq('id_cliente', id_cliente)
        .single();
      
      if (!errorCliente) {
        cliente = clienteData;
      }
    }
    
    // Preparar configuración de factura
    const facturaConfig = {
      infoTributaria: {
        // ambiente se asignará automáticamente desde la BD
        tipoEmision: '1',
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial,
        ruc: emisor.ruc,
        codDoc: '01', // Factura
        estab: emisor.codigo_establecimiento,
        ptoEmi: punto_emision,
        secuencial: numero_secuencial.toString().padStart(9, '0'),
        dirMatriz: emisor.direccion
      },
      infoFactura: {
        fechaEmision: fecha_emision,
        dirEstablecimiento: emisor.direccion,
        obligadoContabilidad: emisor.obligado_contabilidad ? 'SI' : 'NO',
        tipoIdentificacionComprador: cliente?.tipo_identificacion || '07',
        razonSocialComprador: cliente?.nombre || 'CONSUMIDOR FINAL',
        identificacionComprador: cliente?.cedula_ruc || '9999999999999',
        direccionComprador: cliente?.direccion,
        totalSinImpuestos: subtotal,
        totalDescuento: '0.00',
        totalConImpuestos: [{
          codigo: '2',
          codigoPorcentaje: '4',
          baseImponible: subtotal,
          valor: iva_total
        }],
        propina: '0',
        importeTotal: total,
        moneda: 'DOLAR',
        pagos: formas_pago.map(pago => ({
          formaPago: pago.forma_pago,
          total: pago.valor_pago,
          plazo: pago.plazo,
          unidadTiempo: pago.unidad_tiempo
        }))
      },
      detalles: detalles.map(detalle => ({
        codigoPrincipal: detalle.codigo_principal || detalle.id_producto.toString(),
        descripcion: detalle.descripcion,
        cantidad: detalle.cantidad,
        precioUnitario: detalle.precio_unitario,
        descuento: detalle.descuento || '0.00',
        precioTotalSinImpuesto: detalle.subtotal,
        impuestos: [{
          codigo: '2',
          codigoPorcentaje: '4',
          tarifa: '15.0',
          baseImponible: detalle.subtotal,
          valor: detalle.valor_iva
        }]
      })),
      infoAdicional: info_adicional?.map(info => ({
        '@nombre': info.nombre,
        '#text': info.descripcion
      })) || []
    };
    
    // Procesar factura electrónica completa
    const resultadoProcesamiento = await procesarFacturaElectronicaCompleta(facturaConfig);
    
    if (!resultadoProcesamiento.success) {
      return res.status(400).json({
        success: false,
        message: resultadoProcesamiento.mensaje,
        estado: resultadoProcesamiento.estado,
        detalles: resultadoProcesamiento.detalles || resultadoProcesamiento.error,
        claveAcceso: resultadoProcesamiento.claveAcceso
      });
    }
    
    // Guardar en base de datos
    const datosAdicionales = {
      id_emisor,
      id_cliente,
      id_usuario,
      numero_secuencial,
      fecha_emision,
      punto_emision,
      subtotal,
      iva_total,
      total,
      detalles,
      formas_pago,
      info_adicional
    };
    
    const facturaGuardada = await guardarFacturaEnBD(resultadoProcesamiento, datosAdicionales);
    
    // Respuesta exitosa
    return res.status(201).json({
      success: true,
      message: resultadoProcesamiento.mensaje,
      factura: {
        id_factura: facturaGuardada.id_factura,
        clave_acceso: resultadoProcesamiento.claveAcceso,
        numero_autorizacion: resultadoProcesamiento.numeroAutorizacion,
        estado: resultadoProcesamiento.estado,
        ambiente: resultadoProcesamiento.ambiente,
        fecha_autorizacion: facturaGuardada.fecha_autorizacion
      },
      procesamiento: {
        ambiente_usado: resultadoProcesamiento.ambiente,
        xml_generado: true,
        xml_firmado: true,
        enviado_sri: true,
        autorizado: resultadoProcesamiento.estado === 'AUTORIZADA'
      }
    });
    
  } catch (error) {
    console.error('❌ Error en emisión de factura:', error);
    return res.status(500).json({
      success: false,
      message: "Error interno en el procesamiento de la factura",
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
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
    
    const resultado = await consultarEstadoFactura(clave_acceso);
    
    if (!resultado.success) {
      return res.status(500).json({
        success: false,
        message: "Error consultando estado en el SRI",
        details: resultado.error
      });
    }
    
    return res.json({
      success: true,
      ...resultado
    });
    
  } catch (error) {
    console.error('❌ Error consultando estado:', error);
    return res.status(500).json({
      success: false,
      message: "Error interno consultando estado",
      details: error.message
    });
  }
};

/**
 * Obtiene la configuración actual del ambiente SRI
 */
export const obtenerConfiguracionAmbiente = async (req, res) => {
  try {
    const estado = await obtenerEstadoSistema();
    
    return res.json({
      success: true,
      ...estado
    });
    
  } catch (error) {
    console.error('❌ Error obteniendo configuración:', error);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo configuración",
      details: error.message
    });
  }
};

/**
 * Cambia el ambiente SRI (pruebas/producción)
 */
export const cambiarAmbienteFacturacion = async (req, res) => {
  try {
    const { ambiente } = req.body;
    
    if (!ambiente || (ambiente !== 'pruebas' && ambiente !== 'produccion')) {
      return res.status(400).json({
        success: false,
        message: "Ambiente inválido. Debe ser 'pruebas' o 'produccion'"
      });
    }
    
    const nuevaConfiguracion = await cambiarAmbienteSRI(ambiente);
    
    return res.json({
      success: true,
      message: `Ambiente cambiado exitosamente a: ${ambiente}`,
      configuracion: nuevaConfiguracion
    });
    
  } catch (error) {
    console.error('❌ Error cambiando ambiente:', error);
    return res.status(500).json({
      success: false,
      message: "Error cambiando ambiente",
      details: error.message
    });
  }
};

/**
 * Lista las facturas electrónicas con filtros
 */
export const listarFacturasElectronicas = async (req, res) => {
  try {
    const { 
      estado, 
      ambiente, 
      fecha_inicio, 
      fecha_fin, 
      limit = 10, 
      offset = 0 
    } = req.query;
    
    const supabase = await getConnection();
    
    let query = supabase
      .from('factura_electronica')
      .select(`
        *,
        clientes(nombre, cedula_ruc),
        usuarios(nombre_completo),
        emisor(razon_social, nombre_comercial)
      `)
      .order('fecha_registro', { ascending: false })
      .range(offset, offset + limit - 1);
    
    if (estado) {
      query = query.eq('estado', estado);
    }
    
    if (ambiente) {
      query = query.eq('ambiente_sri', ambiente);
    }
    
    if (fecha_inicio) {
      query = query.gte('fecha_emision', fecha_inicio);
    }
    
    if (fecha_fin) {
      query = query.lte('fecha_emision', fecha_fin);
    }
    
    const { data: facturas, error } = await query;
    
    if (error) {
      throw new Error(`Error consultando facturas: ${error.message}`);
    }
    
    // Obtener conteo total
    let countQuery = supabase
      .from('factura_electronica')
      .select('id_factura', { count: 'exact', head: true });
    
    if (estado) countQuery = countQuery.eq('estado', estado);
    if (ambiente) countQuery = countQuery.eq('ambiente_sri', ambiente);
    if (fecha_inicio) countQuery = countQuery.gte('fecha_emision', fecha_inicio);
    if (fecha_fin) countQuery = countQuery.lte('fecha_emision', fecha_fin);
    
    const { count, error: countError } = await countQuery;
    
    return res.json({
      success: true,
      facturas: facturas || [],
      total: count || 0,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    
  } catch (error) {
    console.error('❌ Error listando facturas:', error);
    return res.status(500).json({
      success: false,
      message: "Error consultando facturas",
      details: error.message
    });
  }
};
