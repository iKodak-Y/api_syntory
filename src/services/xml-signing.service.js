/**
 * Servicio para firmar XML con certificado digital
 * Reutiliza la funcionalidad existente del sistema
 */

import { firmarXml } from './facturacion-electronica.service.js';

/**
 * Firma un XML con certificado digital desde Supabase Storage
 * @param {string} xml - XML a firmar
 * @param {string} certificatePath - Ruta del certificado en Supabase
 * @param {string} certificatePassword - Contraseña del certificado
 * @returns {Promise<string>} - XML firmado
 */
export async function signXMLWithCertificate(xml, certificatePath, certificatePassword) {
  console.log('🔐 === FIRMANDO XML CON CERTIFICADO === 🔐');
  console.log('📋 Certificado:', certificatePath);
  console.log('📄 Longitud XML:', xml.length, 'caracteres');
  
  try {
    // Usar la función existente de firmarXml
    const xmlFirmado = await firmarXml(xml, certificatePath, certificatePassword);
    
    console.log('✅ XML firmado exitosamente');
    console.log('📊 Longitud XML firmado:', xmlFirmado.length, 'caracteres');
    
    return xmlFirmado;
    
  } catch (error) {
    console.error('❌ Error al firmar XML:', error.message);
    throw new Error(`Error en firma digital: ${error.message}`);
  }
}
