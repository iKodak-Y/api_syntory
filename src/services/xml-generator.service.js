/**
 * Generador de XML para facturas electrónicas del SRI
 * Basado en la estructura exacta requerida por el SRI Ecuador
 */

import { generateFacturaXMLExacto } from './xml-generator-exacto.service.js';
import { generateFacturaXMLSimple } from './xml-generator-simple.service.js';

/**
 * Genera el XML de una factura electrónica
 * @param {Object} facturaData - Datos de la factura
 * @returns {string} - XML de la factura
 */
export function generateFacturaXML(facturaData) {
  console.log('🔧 === GENERANDO XML PERSONALIZADO === 🔧');
  
  const {
    infoTributaria,
    infoFactura,
    detalles,
    infoAdicional
  } = facturaData;
  
  // Usar el generador exacto para asegurar compatibilidad SRI
  return generateFacturaXMLExacto(facturaData);
}

/**
 * Mapea las formas de pago a los códigos SRI
 * @param {string} formaPago - Forma de pago en el sistema
 * @returns {string} - Código SRI para la forma de pago
 */
export function mapFormaPagoSRI(formaPago) {
  const mapeo = {
    // Mapeos básicos
    'efectivo': "01",
    'cash': "01",
    'dinero': "01",
    
    // Cheques
    'cheque': "02",
    'check': "02",
    
    // Tarjetas de débito
    'debito': "16",
    'tarjeta_debito': "16",
    'debit': "16",
    'debit_card': "16",
    
    // Tarjetas de crédito  
    'credito': "19",
    'tarjeta_credito': "19",
    'credit': "19",
    'credit_card': "19",
    
    // Transferencias
    'transferencia': "20",
    'transferencia_bancaria': "20",
    'transfer': "20",
    'bank_transfer': "20",
    
    // Dinero electrónico
    'dinero_electronico': "17",
    'electronic_money': "17",
    
    // Otros
    'otros': "99",
    'other': "99"
  };
  
  // Normalizar la entrada: minúsculas y sin espacios
  const normalizado = (formaPago || "").toLowerCase().replace(/\s+/g, "_");
  
  // Retornar el código SRI correspondiente o 01 (efectivo) por defecto
  return mapeo[normalizado] || "01";
}

/**
 * Mapea los tipos de identificación a los códigos SRI
 * @param {string} tipoIdentificacion - Tipo de identificación 
 * @param {string} cedula - Número de cédula o RUC
 * @returns {string} - Código SRI para el tipo de identificación
 */
export function mapTipoIdentificacionSRI(tipoIdentificacion, cedula) {
  // Si se proporciona el número de identificación, intentar detectar el tipo
  if (cedula) {
    if (cedula === '9999999999999') return '07'; // Consumidor final
    if (cedula.length === 13 && cedula.endsWith('001')) return '04'; // RUC
    if (cedula.length === 10) return '05'; // Cédula
  }
  
  // Si se proporciona el tipo explícito
  const mapeo = {
    'ruc': '04',
    'cedula': '05', 
    'pasaporte': '06',
    'consumidor_final': '07',
    'identificacion_exterior': '08',
    'placa': '09'
  };
  
  const normalizado = (tipoIdentificacion || "").toLowerCase().replace(/\s+/g, "_");
  
  // Códigos según especificaciones SRI
  switch (normalizado) {
    case '04':
    case 'ruc': 
    case 'r':
      return '04';
    case '05':
    case 'cedula':
    case 'c':
      return '05';
    case '06':
    case 'pasaporte':
    case 'p':
      return '06';
    case '07':
    case 'consumidor_final':
    case 'cf':
      return '07';
    case '08':
    case 'identificacion_exterior':
    case 'id_ext':
      return '08';
    default:
      // Por defecto, consumidor final
      return '07';
  }
}
