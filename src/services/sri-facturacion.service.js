/**
 * Servicio de facturación electrónica para SRI Ecuador
 * Implementación propia sin dependencias de librerías externas de facturación
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { StorageService } from './storage.service.js';
import { XMLBuilder, XMLParser } from 'fast-xml-parser';
import fetch from 'node-fetch';
import { formatearFechaSRI, convertirFechasParaSRI } from './facturacion-electronica.service.js';
import { generarClaveAcceso as generarClaveAccesoSRI } from './clave-acceso-sri.js';
import { signXmlSRI } from './xades-sri-firma.service.js';

// Obtener la ruta base del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

/**
 * Genera una factura electrónica según el esquema del SRI
 * @param {Object} invoice - Datos de la factura
 * @returns {Object} Factura estructurada según esquema SRI
 */
export function generateInvoice(invoice) {
  try {
    console.log("📋 === GENERANDO ESTRUCTURA DE FACTURA SRI === 📋");
    console.log("📄 Datos de entrada:", JSON.stringify(invoice, null, 2));
    
    // Validaciones básicas
    if (!invoice || !invoice.infoTributaria || !invoice.infoFactura) {
      throw new Error("Estructura de factura inválida: falta infoTributaria o infoFactura");
    }
    
    // Validar que los datos críticos estén presentes
    const infoTrib = invoice.infoTributaria;
    const infoFact = invoice.infoFactura;
    
    if (!infoTrib.ruc || !infoTrib.codDoc) {
      throw new Error("Datos tributarios incompletos: faltan RUC o código de documento");
    }
    
    if (!infoFact.fechaEmision || !infoFact.razonSocialComprador) {
      throw new Error("Información de factura incompleta: faltan fecha de emisión o razón social del comprador");
    }
    
    // Crear estructura de factura según esquema SRI - MANTENER ESTRUCTURA ORIGINAL
    // Preservar estructura original - simplemente validar y retornar
    const facturaObj = {
      infoTributaria: {
        ambiente: infoTrib.ambiente,
        tipoEmision: infoTrib.tipoEmision,
        razonSocial: infoTrib.razonSocial,
        nombreComercial: infoTrib.nombreComercial || infoTrib.razonSocial,
        ruc: infoTrib.ruc,
        claveAcceso: infoTrib.claveAcceso || '', // Se generará después si no existe
        codDoc: infoTrib.codDoc,
        estab: infoTrib.estab,
        ptoEmi: infoTrib.ptoEmi,
        secuencial: infoTrib.secuencial,
        dirMatriz: infoTrib.dirMatriz
      },
      infoFactura: {
        fechaEmision: infoFact.fechaEmision,
        dirEstablecimiento: infoFact.dirEstablecimiento || infoTrib.dirMatriz,
        obligadoContabilidad: infoFact.obligadoContabilidad || 'NO',
        tipoIdentificacionComprador: infoFact.tipoIdentificacionComprador,
        razonSocialComprador: infoFact.razonSocialComprador,
        identificacionComprador: infoFact.identificacionComprador,
        totalSinImpuestos: infoFact.totalSinImpuestos,
        totalDescuento: infoFact.totalDescuento,
        totalConImpuestos: infoFact.totalConImpuestos || [],
        propina: infoFact.propina || '0',
        importeTotal: infoFact.importeTotal,
        moneda: infoFact.moneda || 'DOLAR',
        pagos: infoFact.pagos || []
      },
      detalles: invoice.detalles || [],
      infoAdicional: invoice.infoAdicional || []
    };

    // Añadir dirección del comprador si existe
    if (infoFact.direccionComprador) {
      facturaObj.infoFactura.direccionComprador = infoFact.direccionComprador;
    }
    
    console.log("✅ Estructura de factura SRI validada y preservada");
    console.log("📄 Factura procesada:", JSON.stringify(facturaObj, null, 2));
    return facturaObj;
  } catch (error) {
    console.error("❌ Error generando estructura de factura:", error);
    throw new Error(`Error generando estructura de factura: ${error.message}`);
  }
}

/**
 * Convierte la estructura de factura a XML según esquema SRI
 * @param {Object} facturaObj - Objeto de factura estructurado
 * @returns {String} XML de la factura
 */
export function generateInvoiceXml(facturaObj) {
  try {
    console.log("🔄 === CONVIRTIENDO FACTURA A XML === 🔄");
    
    // Configurar XMLBuilder con opciones específicas para SRI
    const builder = new XMLBuilder({
      attributeNamePrefix: '@',
      textNodeName: '#text',
      ignoreAttributes: false,
      format: true,
      indentBy: '  ',
      suppressEmptyNode: true,
      suppressBooleanAttributes: false
    });
    
    // Generar XML con declaración y namespace
    const xmlContent = builder.build(facturaObj);
    
    // Añadir declaración XML y namespace específico del SRI
    const xmlWithDeclaration = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0" xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#">
${xmlContent.replace(/<factura[^>]*>/, '').replace('</factura>', '')}
</factura>`;
    
    console.log("✅ XML de factura generado exitosamente");
    console.log(`📏 Longitud del XML: ${xmlWithDeclaration.length} caracteres`);
    
    return xmlWithDeclaration;
  } catch (error) {
    console.error("❌ Error generando XML:", error);
    throw new Error(`Error generando XML: ${error.message}`);
  }
}

/**
 * Firma un XML usando un certificado p12 con formato XAdES compatible con SRI
 * @param {String} xmlContent - Contenido XML a firmar
 * @param {Buffer} p12Buffer - Buffer con el certificado
 * @param {String} password - Contraseña del certificado
 * @returns {String} XML firmado
 */
export async function signXml(xmlContent, p12Buffer, password) {
  try {
    console.log("🔐 === DELEGANDO A IMPLEMENTACIÓN MEJORADA XAdS SRI === 🔐");
    
    // Usar la nueva implementación mejorada de firma XAdES
    return signXmlSRI(xmlContent, p12Buffer, password);
    
  } catch (error) {
    console.error("❌ Error firmando XML:", error);
    throw new Error(`Error firmando XML: ${error.message}`);
  }
}

/**
 * Envía un documento XML al servicio de recepción del SRI
 * @param {String} xmlContent - Contenido XML firmado
 * @param {String} url - URL del servicio de recepción
 * @returns {Object} Respuesta del SRI
 */
export async function documentReception(xmlContent, url) {
  try {
    console.log(`📤 Enviando documento al SRI: ${url}`);
    
    // Validar XML antes de enviar
    if (!xmlContent || typeof xmlContent !== 'string') {
      throw new Error(`XML inválido para enviar al SRI. Tipo: ${typeof xmlContent}, Longitud: ${xmlContent?.length || 0}`);
    }
    
    // Extraer la clave de acceso del XML para validación
    const claveAccesoMatch = xmlContent.match(/<claveAcceso>([^<]+)<\/claveAcceso>/);
    const claveAcceso = claveAccesoMatch ? claveAccesoMatch[1] : 'No encontrada';
    console.log(`🔑 Clave de acceso detectada: ${claveAcceso}`);
    
    // CORRECCIÓN CRÍTICA: Asegurarnos que el XML no tenga problemas con caracteres especiales 
    // y se envíe en el formato requerido por el SRI (base64)
    const base64XmlContent = Buffer.from(xmlContent).toString('base64');
    console.log(`📝 XML codificado en Base64 para envío seguro al SRI`);
    
    // Crear el SOAP envelope para recepción asegurando que el contenido esté en base64
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soap:Header/>
  <soap:Body>
    <ec:validarComprobante>
      <xml>${base64XmlContent}</xml>
    </ec:validarComprobante>
  </soap:Body>
</soap:Envelope>`;
    
    console.log(`📦 SOAP envelope preparado. Longitud: ${soapEnvelope.length} caracteres`);
    console.log(`📄 SOAP envelope primeros 100 caracteres: ${soapEnvelope.substring(0, 100)}...`);
    
    // Configurar headers para el SRI
    const headers = {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '', // El SRI requiere SOAPAction vacío
      'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8')
    };
    
    console.log("📡 Headers configurados:", headers);
    
    // Enviar request al SRI
    console.log(`🚀 Enviando request a: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: soapEnvelope,
      timeout: 30000 // 30 segundos timeout
    });
    
    console.log(`📨 Respuesta recibida - Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP del SRI: ${response.status} - ${errorText}`);
      throw new Error(`Error HTTP del SRI: ${response.status} - ${response.statusText}`);
    }
    
    // Procesar respuesta XML del SRI
    const responseText = await response.text();
    console.log(`📝 Respuesta del SRI (${responseText.length} chars):`, responseText);
    
    // Parsear respuesta SOAP
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      textNodeName: '#text'
    });
    
    const parsedResponse = parser.parse(responseText);
    console.log("🔍 Respuesta parseada:", JSON.stringify(parsedResponse, null, 2));
    
    // Extraer resultado desde la estructura SOAP
    let resultado = null;
    try {
      // Buscar en diferentes posibles ubicaciones de la respuesta
      const soapBody = parsedResponse['soap:Envelope']?.['soap:Body'] || 
                       parsedResponse['env:Envelope']?.['env:Body'] ||
                       parsedResponse['soapenv:Envelope']?.['soapenv:Body'];
      
      if (soapBody) {
        const validarResponse = soapBody['ns2:validarComprobanteResponse'] ||
                               soapBody['ec:validarComprobanteResponse'] ||
                               soapBody['validarComprobanteResponse'];
        
        if (validarResponse) {
          resultado = validarResponse['RespuestaRecepcionComprobante'] ||
                     validarResponse['return'] ||
                     validarResponse;
        }
      }
    } catch (parseError) {
      console.error("❌ Error parseando respuesta SOAP:", parseError);
    }
    
    if (!resultado) {
      console.warn("⚠️ No se pudo extraer resultado estructurado, usando respuesta completa");
      resultado = parsedResponse;
    }
    
    console.log("✅ Resultado final de recepción:", JSON.stringify(resultado, null, 2));
    return resultado;
    
  } catch (error) {
    console.error("❌ Error en recepción SRI:", error);
    throw new Error(`Error en recepción SRI: ${error.message}`);
  }
}

/**
 * Consulta la autorización de un comprobante en el SRI
 * @param {String} claveAcceso - Clave de acceso del comprobante
 * @param {String} url - URL del servicio de autorización
 * @returns {Object} Respuesta del SRI
 */
export async function documentAuthorization(claveAcceso, url) {
  try {
    console.log(`🔍 Consultando autorización en SRI: ${claveAcceso}`);
    console.log(`📡 URL de autorización: ${url}`);
    
    // Validar clave de acceso
    if (!claveAcceso || claveAcceso.length !== 49) {
      throw new Error(`Clave de acceso inválida: ${claveAcceso}`);
    }
    
    // Crear el SOAP envelope para autorización
    const soapEnvelope = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.autorizacion">
  <soap:Header />
  <soap:Body>
    <ec:autorizacionComprobante>
      <claveAccesoComprobante>${claveAcceso}</claveAccesoComprobante>
    </ec:autorizacionComprobante>
  </soap:Body>
</soap:Envelope>`;
    
    console.log(`📦 SOAP envelope autorización preparado. Longitud: ${soapEnvelope.length} caracteres`);
    
    // Configurar headers
    const headers = {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': '', // El SRI requiere SOAPAction vacío
      'Content-Length': Buffer.byteLength(soapEnvelope, 'utf8')
    };
    
    // Enviar request al SRI
    console.log(`🚀 Enviando consulta de autorización a: ${url}`);
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: soapEnvelope,
      timeout: 30000 // 30 segundos timeout
    });
    
    console.log(`📨 Respuesta de autorización - Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error HTTP en autorización: ${response.status} - ${errorText}`);
      throw new Error(`Error HTTP en autorización: ${response.status} - ${response.statusText}`);
    }
    
    // Procesar respuesta XML del SRI
    const responseText = await response.text();
    console.log(`📝 Respuesta de autorización (${responseText.length} chars):`, responseText);
    
    // Parsear respuesta SOAP
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@',
      textNodeName: '#text'
    });
    
    const parsedResponse = parser.parse(responseText);
    console.log("🔍 Respuesta de autorización parseada:", JSON.stringify(parsedResponse, null, 2));
    
    // Extraer resultado de autorización desde la estructura SOAP
    let resultado = null;
    try {
      const soapBody = parsedResponse['soap:Envelope']?.['soap:Body'] || 
                       parsedResponse['env:Envelope']?.['env:Body'] ||
                       parsedResponse['soapenv:Envelope']?.['soapenv:Body'];
      
      if (soapBody) {
        const authResponse = soapBody['ns2:autorizacionComprobanteResponse'] ||
                            soapBody['ec:autorizacionComprobanteResponse'] ||
                            soapBody['autorizacionComprobanteResponse'];
        
        if (authResponse) {
          resultado = authResponse['RespuestaAutorizacionComprobante'] ||
                     authResponse['return'] ||
                     authResponse;
        }
      }
    } catch (parseError) {
      console.error("❌ Error parseando respuesta de autorización:", parseError);
    }
    
    if (!resultado) {
      console.warn("⚠️ No se pudo extraer resultado de autorización, usando respuesta completa");
      resultado = parsedResponse;
    }
    
    console.log("✅ Resultado final de autorización:", JSON.stringify(resultado, null, 2));
    return resultado;
    
  } catch (error) {
    console.error("❌ Error en autorización SRI:", error);
    throw new Error(`Error en autorización SRI: ${error.message}`);
  }
}

/**
 * Genera una clave de acceso para documentos electrónicos del SRI
 * @param {Object} infoTributaria - Información tributaria del documento
 * @returns {String} Clave de acceso de 49 dígitos
 */
export function generarClaveAcceso(infoTributaria) {
  try {
    console.log("🔑 === GENERANDO CLAVE DE ACCESO === 🔑");
    
    // Delegar a la implementación específica de clave de acceso
    return generarClaveAccesoSRI(infoTributaria);
    
  } catch (error) {
    console.error("❌ Error generando clave de acceso:", error);
    throw new Error(`Error generando clave de acceso: ${error.message}`);
  }
}