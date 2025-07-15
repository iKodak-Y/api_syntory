/**
 * Servicio para gestión de ambientes SRI desde la base de datos
 * Permite cambiar entre pruebas y producción dinámicamente
 */

import { getConnection } from '../database/connection.js';

/**
 * Obtiene la configuración actual del ambiente SRI desde la base de datos
 * @returns {Object} Configuración del ambiente SRI
 */
export async function obtenerConfiguracionAmbienteSRI() {
  try {
    const supabase = await getConnection();
    if (!supabase) {
      throw new Error("No se pudo conectar a la base de datos");
    }

    // Obtener configuración del emisor
    const { data: emisor, error: emisorError } = await supabase
      .from('emisor')
      .select('*')
      .eq('id_emisor', 1)
      .single();

    if (emisorError) {
      throw new Error(`Error al obtener emisor: ${emisorError.message}`);
    }

    // Obtener configuración SRI
    const { data: configSRI, error: configError } = await supabase
      .from('configuracion_sri')
      .select('*')
      .eq('id_configuracion', 1)
      .single();

    if (configError) {
      console.warn(`No se pudo obtener configuración SRI: ${configError.message}`);
    }

    // Determinar ambiente actual
    const ambienteActual = emisor.tipo_ambiente || configSRI?.ambiente_defecto || 'pruebas';
    
    // URLs según ambiente
    const urls = {
      pruebas: {
        recepcion: configSRI?.url_recepcion_pruebas || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        autorizacion: configSRI?.url_autorizacion_pruebas || 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
      },
      produccion: {
        recepcion: configSRI?.url_recepcion_produccion || 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        autorizacion: configSRI?.url_autorizacion_produccion || 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
      }
    };

    return {
      ambiente: ambienteActual,
      ambienteNumerico: ambienteActual === 'produccion' ? '2' : '1',
      urls: urls[ambienteActual],
      emisor: emisor,
      configuracion: configSRI,
      certificado: {
        path: emisor.certificado_path,
        password: emisor.contrasena_certificado,
        valido: emisor.fecha_vencimiento_certificado > new Date().toISOString().split('T')[0]
      }
    };

  } catch (error) {
    console.error('❌ Error obteniendo configuración de ambiente SRI:', error);
    throw new Error(`Error obteniendo configuración SRI: ${error.message}`);
  }
}

/**
 * Cambia el ambiente SRI en la base de datos
 * @param {string} nuevoAmbiente - 'pruebas' o 'produccion'
 * @returns {Object} Resultado de la operación
 */
export async function cambiarAmbienteSRI(nuevoAmbiente) {
  if (nuevoAmbiente !== 'pruebas' && nuevoAmbiente !== 'produccion') {
    throw new Error("El ambiente debe ser 'pruebas' o 'produccion'");
  }

  try {
    console.log(`🔧 Cambiando ambiente SRI a: ${nuevoAmbiente}`);
    
    const supabase = await getConnection();
    if (!supabase) {
      throw new Error("No se pudo conectar a la base de datos");
    }

    // Actualizar emisor
    const { data: emisorData, error: emisorError } = await supabase
      .from('emisor')
      .update({ tipo_ambiente: nuevoAmbiente })
      .eq('id_emisor', 1)
      .select()
      .single();

    if (emisorError) {
      throw new Error(`Error actualizando emisor: ${emisorError.message}`);
    }

    // Actualizar configuración SRI
    const { data: configData, error: configError } = await supabase
      .from('configuracion_sri')
      .update({ 
        ambiente_defecto: nuevoAmbiente,
        fecha_modificacion: new Date().toISOString()
      })
      .eq('id_configuracion', 1);

    if (configError) {
      console.warn(`⚠️ No se pudo actualizar configuracion_sri: ${configError.message}`);
    }

    console.log(`✅ Ambiente cambiado exitosamente a: ${nuevoAmbiente}`);
    
    // Retornar nueva configuración
    return await obtenerConfiguracionAmbienteSRI();

  } catch (error) {
    console.error('❌ Error cambiando ambiente SRI:', error);
    throw new Error(`Error cambiando ambiente SRI: ${error.message}`);
  }
}

/**
 * Valida que el certificado esté vigente para el ambiente
 * @param {Object} configuracion - Configuración del ambiente
 * @returns {Object} Estado de validación del certificado
 */
export function validarCertificado(configuracion) {
  try {
    const fechaVencimiento = new Date(configuracion.emisor.fecha_vencimiento_certificado);
    const hoy = new Date();
    const diasParaVencer = Math.ceil((fechaVencimiento - hoy) / (1000 * 60 * 60 * 24));

    return {
      valido: fechaVencimiento > hoy,
      diasParaVencer: diasParaVencer,
      fechaVencimiento: fechaVencimiento.toLocaleDateString(),
      path: configuracion.certificado.path,
      advertencia: diasParaVencer <= 30 && diasParaVencer > 0 ? `El certificado vence en ${diasParaVencer} días` : null,
      critico: diasParaVencer <= 0 ? 'El certificado ha vencido' : null
    };
  } catch (error) {
    return {
      valido: false,
      error: `Error validando certificado: ${error.message}`
    };
  }
}

/**
 * Obtiene información del estado del sistema de facturación
 * @returns {Object} Estado completo del sistema
 */
export async function obtenerEstadoSistema() {
  try {
    const configuracion = await obtenerConfiguracionAmbienteSRI();
    const certificado = validarCertificado(configuracion);
    
    return {
      ambiente: configuracion.ambiente,
      ambienteNumerico: configuracion.ambienteNumerico,
      urls: configuracion.urls,
      certificado: certificado,
      emisor: {
        ruc: configuracion.emisor.ruc,
        razonSocial: configuracion.emisor.razon_social,
        nombreComercial: configuracion.emisor.nombre_comercial,
        establecimiento: configuracion.emisor.codigo_establecimiento,
        puntoEmision: configuracion.emisor.punto_emision
      },
      sistema: {
        listo: certificado.valido && configuracion.urls && configuracion.emisor,
        problemas: []
      }
    };
  } catch (error) {
    return {
      error: error.message,
      sistema: {
        listo: false,
        problemas: [error.message]
      }
    };
  }
}
