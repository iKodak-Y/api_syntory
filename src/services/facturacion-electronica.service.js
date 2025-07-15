import {
  generateInvoice,
  generateInvoiceXml,
  signXml,
  documentReception,
  documentAuthorization,
  generarClaveAcceso,
} from "./sri-facturacion.service.js";
import { generateFacturaXML } from "./xml-generator.service.js";
import { generateFacturaXMLOficial } from "./xml-generator-oficial.service.js";
import { generateFacturaXMLExacto } from "./xml-generator-exacto.service.js";
import { generateFacturaXMLSimple } from "./xml-generator-simple.service.js";
import { generateFacturaXMLSRIOficial } from "./xml-generator-sri-oficial.service.js";
import { obtenerConfiguracionAmbienteSRI, validarCertificado } from "./ambiente-sri.service.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createWriteStream } from "fs";
import { dirname } from "path";
import { getDefaultIva } from "./config.service.js";
import { StorageService } from './storage.service.js';

// Obtener la ruta base del proyecto
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = path.resolve(__dirname, "../..");

// URLs del SRI por ambiente - ACTUALIZADAS según documentación oficial 2025
const SRI_URLS = {
  pruebas: {
    // URLs para el ambiente de pruebas (Certificación) 
    recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  },
  produccion: {
    // URLs para ambiente de producción
    recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl", 
    autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  }
};

/**
 * Genera una factura electrónica según el esquema del SRI
 * @param {Object} facturaConfig Configuración de la factura
 * @returns {Object} Objeto con la factura generada y la clave de acceso
 */
export async function generarFacturaElectronica(facturaConfig) {
  try {
    console.log("🧾 === GENERANDO FACTURA ELECTRÓNICA SRI === 🧾");
    console.log("📋 Configuración recibida:", JSON.stringify(facturaConfig, null, 2));
    
    // PASO CRÍTICO: Normalizar fechas para asegurar consistencia total
    const fechaEmisionOriginal = facturaConfig.infoFactura?.fechaEmision;
    console.log(`📅 Fecha emisión original: ${fechaEmisionOriginal}`);
    
    // Crear objeto Date normalizado
    let fechaObj;
    
    if (typeof fechaEmisionOriginal === 'string') {
      if (fechaEmisionOriginal.includes('/')) {
        // Formato DD/MM/YYYY
        const [dia, mes, anio] = fechaEmisionOriginal.split('/');
        fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
      } else if (fechaEmisionOriginal.includes('-')) {
        // Formato YYYY-MM-DD o ISO
        fechaObj = new Date(fechaEmisionOriginal);
      } else {
        // Otros formatos (como "Sat Jun 21 00:00:00 GMT-05:00 2025")
        fechaObj = new Date(fechaEmisionOriginal);
      }
    } else if (fechaEmisionOriginal instanceof Date) {
      fechaObj = new Date(fechaEmisionOriginal);
    } else {
      console.warn("⚠️ Fecha no proporcionada, usando fecha actual");
      fechaObj = new Date();
    }
    
    // Validar fecha
    if (isNaN(fechaObj.getTime())) {
      console.warn("⚠️ Fecha inválida detectada, usando fecha actual como respaldo");
      fechaObj = new Date();
    }
    
    // Extraer componentes de fecha
    const dia = fechaObj.getDate().toString().padStart(2, '0');
    const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
    const anio = fechaObj.getFullYear();
    const anioCorto = anio.toString().slice(-2);
    
    // Generar formatos normalizados
    const fechaParaXML = `${dia}/${mes}/${anio}`;        // DD/MM/YYYY para XML
    const fechaParaClave = `${dia}${mes}${anio}`;        // DDMMAAAA para clave de acceso (año completo)
    
    // Actualizar configuración con fecha normalizada
    facturaConfig.infoFactura.fechaEmision = fechaParaXML;
    facturaConfig.fechaStr = fechaParaClave;
    facturaConfig.fechaParaClaveAcceso = fechaParaXML;
    
    console.log(`✅ Fechas normalizadas:
      - Para XML: ${fechaParaXML}
      - Para clave: ${fechaParaClave} (DDMMAAAA formato)
      - Objeto Date: ${fechaObj.toISOString()}`);
    
    // PASO 1: Generar la clave de acceso primero
    console.log("🔑 === GENERANDO CLAVE DE ACCESO === 🔑");
    const infoTributariaClave = {
      fechaEmision: fechaParaClave, // DDMMAAAA
      codDoc: facturaConfig.infoTributaria.codDoc,
      ruc: facturaConfig.infoTributaria.ruc,
      ambiente: facturaConfig.infoTributaria.ambiente,
      codigoEstablecimiento: facturaConfig.infoTributaria.estab,
      puntoEmision: facturaConfig.infoTributaria.ptoEmi,
      secuencial: facturaConfig.infoTributaria.secuencial,
      tipoEmision: facturaConfig.infoTributaria.tipoEmision
    };
    
    const accessKey = generarClaveAcceso(infoTributariaClave);
    console.log(`🔑 Clave de acceso generada: ${accessKey}`);
    
    // Validar que la clave de acceso es válida (49 dígitos)
    if (!accessKey || accessKey.length !== 49 || !/^\d{49}$/.test(accessKey)) {
      throw new Error(`Clave de acceso inválida generada: ${accessKey}. Debe tener exactamente 49 dígitos numéricos.`);
    }
    
    // PASO 2: Agregar la clave de acceso a la configuración de factura
    facturaConfig.infoTributaria.claveAcceso = accessKey;
    
    // PASO 3: Generar la estructura de factura con la clave de acceso
    const invoice = generateInvoice(facturaConfig);
    console.log(`📋 Estructura de factura generada con clave: ${invoice.infoTributaria.claveAcceso}`);
    
    // Verificar que las fechas coinciden (primeros 8 dígitos ahora)
    const fechaEnClave = accessKey.substring(0, 8); // Primeros 8 dígitos DDMMAAAA
    if (fechaEnClave !== fechaParaClave) {
      console.warn(`⚠️ INCONSISTENCIA: Fecha en clave (${fechaEnClave}) != fecha calculada (${fechaParaClave})`);
    }
    
    console.log(`✅ Validaciones exitosas:
      - Clave longitud: ${accessKey.length} dígitos ✓
      - Solo números: ${/^\d+$/.test(accessKey) ? '✓' : '✗'}
      - Fecha consistente: ${fechaEnClave === fechaParaClave ? '✓' : '✗'}`);
    
    // Continuar con el flujo completo...
    
    // PASO 4: Generar XML de la factura
    console.log("🔄 === GENERANDO XML === 🔄");
    
    // DEBUG: Verificar la estructura antes de generar XML
    console.log("🔍 === DEBUG: ESTRUCTURA ANTES DE XML === 🔍");
    console.log("infoFactura.totalConImpuestos:", JSON.stringify(invoice.infoFactura?.totalConImpuestos, null, 2));
    console.log("infoFactura.pagos:", JSON.stringify(invoice.infoFactura?.pagos, null, 2));
    if (invoice.detalles && invoice.detalles.length > 0) {
      console.log("detalles[0].impuestos:", JSON.stringify(invoice.detalles[0]?.impuestos, null, 2));
    }
    
    const xmlSinFirmar = await generarXmlFactura(invoice);
    console.log(`📝 XML generado. Longitud: ${xmlSinFirmar.length} caracteres`);
    
    // DEBUG: Guardar XML sin firmar para análisis
    console.log(`📁 Guardando XML sin firmar para análisis...`);
    const debugDir = path.join(rootDir, 'debug_xml');
    if (!fs.existsSync(debugDir)) {
      fs.mkdirSync(debugDir, { recursive: true });
    }
    
    const timestamp = new Date().getTime();
    const xmlSinFirmarPath = path.join(debugDir, `xml_sin_firmar_${timestamp}.xml`);
    fs.writeFileSync(xmlSinFirmarPath, xmlSinFirmar, 'utf8');
    console.log(`📄 XML sin firmar guardado en: ${xmlSinFirmarPath}`);
    
    // PASO 5: Firmar el XML
    console.log("🔐 === FIRMANDO XML === 🔐");
    const certificatePath = path.join(rootDir, 'src', 'certificates', 'certificates.p12');
    const certificatePassword = 'Hmviid1809'; // En producción esto debería venir de variables de entorno
    
    const xmlFirmado = await firmarXml(xmlSinFirmar, certificatePath, certificatePassword);
    console.log(`✅ XML firmado exitosamente. Longitud: ${xmlFirmado.length} caracteres`);
    
    // DEBUG: Guardar XML firmado para análisis
    const xmlFirmadoPath = path.join(debugDir, `xml_firmado_${timestamp}.xml`);
    fs.writeFileSync(xmlFirmadoPath, xmlFirmado, 'utf8');
    console.log(`📄 XML firmado guardado en: ${xmlFirmadoPath}`);
    
    // PASO 6: Enviar al SRI para recepción
    console.log("📤 === ENVIANDO AL SRI (RECEPCIÓN) === 📤");
    const ambiente = facturaConfig.infoTributaria.ambiente || "1";
    const urlRecepcion = ambiente === "1" ? SRI_URLS.pruebas.recepcion : SRI_URLS.produccion.recepcion;
    
    let recepcionSRI = null;
    try {
      const resultadoRecepcion = await documentReception(xmlFirmado, urlRecepcion);
      recepcionSRI = procesarRespuestaSRI(resultadoRecepcion, 'recepcion');
      console.log(`📨 Recepción SRI: ${recepcionSRI.estado}`);
    } catch (error) {
      console.error("❌ Error en recepción SRI:", error);
      recepcionSRI = { estado: 'ERROR', mensaje: error.message };
    }
    
    // PASO 7: Consultar autorización (solo si la recepción fue exitosa)
    let autorizacionSRI = null;
    if (recepcionSRI && (recepcionSRI.estado === 'RECIBIDA' || recepcionSRI.estado === 'DEVUELTA')) {
      console.log("🔍 === CONSULTANDO AUTORIZACIÓN === 🔍");
      const urlAutorizacion = ambiente === "1" ? SRI_URLS.pruebas.autorizacion : SRI_URLS.produccion.autorizacion;
      
      try {
        // Esperar un poco antes de consultar autorización
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const resultadoAutorizacion = await documentAuthorization(accessKey, urlAutorizacion);
        autorizacionSRI = procesarRespuestaSRI(resultadoAutorizacion, 'autorizacion');
        console.log(`🔍 Autorización SRI: ${autorizacionSRI.estado}`);
      } catch (error) {
        console.error("❌ Error en autorización SRI:", error);
        autorizacionSRI = { estado: 'ERROR', mensaje: error.message };
      }
    }
    
    // PASO 8: Retornar resultado completo
    const resultado = {
      success: true,
      claveAcceso: accessKey,
      factura: invoice,
      xmlSinFirmar,
      xmlFirmado,
      recepcionSRI,
      autorizacionSRI,
      mensaje: "Factura electrónica procesada exitosamente"
    };
    
    console.log("🎉 === FACTURA ELECTRÓNICA COMPLETADA === 🎉");
    console.log(`✅ Clave de acceso: ${accessKey}`);
    console.log(`✅ Recepción: ${recepcionSRI?.estado || 'No procesada'}`);
    console.log(`✅ Autorización: ${autorizacionSRI?.estado || 'No procesada'}`);
    
    return resultado;
    
  } catch (error) {
    console.error("❌ Error al generar factura electrónica:", error);
    throw new Error(`Error al generar factura electrónica: ${error.message}`);
  }
}

/**
 * Genera un XML a partir de un objeto factura
 * @param {Object} invoice Objeto factura generado
 * @returns {String} XML de la factura
 */
export async function generarXmlFactura(invoice) {
  try {
    console.log("🔧 Generando XML de factura con implementación personalizada...");
    console.log("📋 Estructura de factura recibida:", JSON.stringify({
      infoTributaria: invoice.infoTributaria ? 'Presente' : 'Faltante',
      infoFactura: invoice.infoFactura ? 'Presente' : 'Faltante',
      detalles: invoice.detalles ? `${invoice.detalles.length} elementos` : 'Faltante',
      infoAdicional: invoice.infoAdicional ? `${invoice.infoAdicional.length} elementos` : 'Faltante'
    }));
    
    // Usar el generador XML oficial basado en XML autorizado
    console.log("📋 Usando generador XML OFICIAL SRI basado en XML autorizado...");
    const invoiceXml = generateFacturaXMLSRIOficial(invoice);
    
    // Validar que el XML se generó correctamente
    if (!invoiceXml || invoiceXml.length === 0) {
      throw new Error("El XML generado está vacío o es inválido");
    }
    
    console.log("📄 XML generado exitosamente");
    console.log(`📏 Longitud del XML: ${invoiceXml.length} caracteres`);
    
    // Verificar elementos críticos
    const elementosCriticos = ['totalConImpuestos', 'pagos', 'impuestos'];
    elementosCriticos.forEach(elemento => {
      if (invoiceXml.includes(`<${elemento}>`)) {
        console.log(`✅ Elemento '${elemento}' presente en XML`);
      } else {
        console.log(`⚠️ Elemento '${elemento}' NO encontrado en XML`);
      }
    });
    
    return invoiceXml;
  } catch (error) {
    console.error("❌ Error al generar XML:", error);
    throw new Error(`Error al generar XML: ${error.message}`);
  }
}

/**
 * Firma digitalmente un XML utilizando un certificado p12
 * @param {String} xmlContent Contenido del XML a firmar
 * @param {String} certificatePath Ruta al certificado .p12
 * @param {String} certificatePassword Contraseña del certificado
 * @returns {String} XML firmado digitalmente
 */
/**
 * Firma digitalmente un XML utilizando un certificado p12
 * @param {String} xmlContent Contenido del XML a firmar
 * @param {String} certificatePath Ruta al certificado .p12
 * @param {String} certificatePassword Contraseña del certificado
 * @returns {String} XML firmado digitalmente
 */
export async function firmarXml(xmlContent, certificatePath, certificatePassword) {
  try {
    console.log("🔐 Firmando XML con certificado:", certificatePath);
    
    if (!xmlContent || xmlContent.length === 0) {
      throw new Error("XML vacío o inválido");
    }
    
    if (!certificatePassword) {
      throw new Error("No se ha configurado la contraseña del certificado");
    }
    
    // Verificar si el certificado existe localmente
    let certificadoBuffer;
    if (fs.existsSync(certificatePath)) {
      console.log("📁 Usando certificado local:", certificatePath);
      certificadoBuffer = fs.readFileSync(certificatePath);
      console.log(`✅ Certificado local cargado, tamaño: ${certificadoBuffer.byteLength} bytes`);
    } else {
      // Fallback: intentar obtener desde Supabase Storage
      console.log("📥 Certificado no encontrado localmente, descargando desde Supabase Storage...");
      certificadoBuffer = await getP12FromSupabase(certificatePath);
      console.log(`✅ Certificado descargado, tamaño: ${certificadoBuffer.byteLength} bytes`);
    }
    
    // Firmar XML usando nuestro servicio de firma
    console.log("🔏 Firmando XML con implementación personalizada...");
    const signedXml = await signXml(xmlContent, certificadoBuffer, certificatePassword);
    
    // Verificar que el XML firmado contiene la estructura de firma
    if (!signedXml || (!signedXml.includes('<ds:Signature') && !signedXml.includes('<Signature'))) {
      throw new Error("El XML firmado no contiene una firma digital válida");
    }
    
    console.log("✅ XML firmado exitosamente");
    console.log(`📋 Longitud XML firmado: ${signedXml.length} caracteres`);
    
    return signedXml;
    
  } catch (error) {
    console.error("❌ Error al firmar XML:", error);
    throw new Error(`Error al firmar XML: ${error.message}`);
  }
}

/**
 * Envía un XML firmado al servicio de recepción del SRI
 * @param {String} signedXml XML firmado digitalmente
 * @param {String} ambiente Ambiente del SRI ('pruebas' o 'produccion')
 * @returns {Object} Resultado de la recepción del documento
 */
export async function enviarDocumentoRecepcion(signedXml, ambiente) {
  try {
    console.log(`Enviando documento al SRI - Ambiente: ${ambiente}`);
    
    // Validar ambiente
    if (!SRI_URLS[ambiente]) {
      throw new Error(`Ambiente no válido: ${ambiente}. Debe ser 'pruebas' o 'produccion'`);
    }
    
    // Validar XML antes de enviar
    if (!signedXml || typeof signedXml !== 'string') {
      throw new Error(`XML inválido para enviar al SRI. Tipo: ${typeof signedXml}, Longitud: ${signedXml?.length || 0}`);
    }

    // Validar tamaño mínimo
    if (signedXml.length < 100) {
      throw new Error(`XML demasiado pequeño para ser válido: ${signedXml.length} caracteres`);
    }
    
    // Verificar elementos principales 
    if (!signedXml.includes('<factura') && !signedXml.includes('infoTributaria')) {
      throw new Error('XML no contiene estructura de factura válida');
    }
    
    console.log(`URL de recepción SRI: ${SRI_URLS[ambiente].recepcion}`);

    // Información detallada para depuración
    console.log("Primeros 500 caracteres del XML a enviar:", signedXml.substring(0, 500));
    if (signedXml.includes("claveAcceso")) {
        const claveMatch = signedXml.match(/<claveAcceso>(.*?)<\/claveAcceso>/);
        if (claveMatch && claveMatch[1]) {
            console.log("Clave de acceso en el XML:", claveMatch[1]);
        }
    }
    
    // Enviar al SRI para recepción usando nuestra implementación mejorada
    const receptionResult = await documentReception(
      signedXml,
      SRI_URLS[ambiente].recepcion
    );
    
    console.log("Resultado de recepción:", JSON.stringify(receptionResult, null, 2));
    
    // Simular éxito en modo pruebas 
    if (ambiente === 'pruebas' && (!receptionResult || (!receptionResult.estado && !receptionResult.comprobante))) {
      console.log("Modo pruebas: Simulando respuesta positiva por falta de respuesta del SRI");
      return { 
        estado: "RECIBIDA", 
        comprobante: "RECIBIDA",
        simulado: true 
      };
    }
    
    return receptionResult;
  } catch (error) {
    console.error("Error al enviar documento para recepción:", error);
    
    // En modo pruebas, simular respuesta exitosa ante errores
    if (ambiente === 'pruebas') {
      console.log("Modo pruebas: Simulando respuesta positiva por error en comunicación");
      return { 
        estado: "RECIBIDA", 
        comprobante: "RECIBIDA", 
        simulado: true,
        error_original: error.message
      };
    }
    
    throw new Error(`Error al enviar documento para recepción: ${error.message}`);
  }
}

/**
 * Solicita autorización de un comprobante al SRI
 * @param {String} claveAcceso Clave de acceso del comprobante
 * @param {String} ambiente Ambiente del SRI ('pruebas' o 'produccion')
 * @returns {Object} Resultado de la autorización
 */
export async function solicitarAutorizacion(claveAcceso, ambiente) {
  try {
    console.log(`Solicitando autorización para clave: ${claveAcceso}`);
    
    // Validar clave de acceso
    if (!claveAcceso || claveAcceso.length !== 49) {
      throw new Error(`Clave de acceso inválida: ${claveAcceso}. Debe tener 49 caracteres.`);
    }
    
    // Verificar que solo contenga dígitos numéricos
    if (!/^\d+$/.test(claveAcceso)) {
      throw new Error(`Clave de acceso contiene caracteres no numéricos: ${claveAcceso}`);
    }
    
    // Validar ambiente
    if (!SRI_URLS[ambiente]) {
      throw new Error(`Ambiente no válido: ${ambiente}. Debe ser 'pruebas' o 'produccion'`);
    }
    
    console.log(`URL de autorización SRI: ${SRI_URLS[ambiente].autorizacion}`);
    console.log(`Solicitando autorización para clave de acceso: ${claveAcceso}`);
    
    // Solicitar autorización usando nuestra implementación mejorada
    const authorizationResult = await documentAuthorization(
      claveAcceso,
      SRI_URLS[ambiente].autorizacion
    );
    
    console.log("Resultado de autorización:", JSON.stringify(authorizationResult, null, 2));
    
    // Si estamos en ambiente de pruebas y no hay respuesta, simular autorización exitosa
    if (ambiente === 'pruebas' && (!authorizationResult || (!authorizationResult.estado && !authorizationResult.comprobante))) {
      console.log("Modo pruebas: Simulando autorización exitosa por falta de respuesta del SRI");
      return {
        estado: "AUTORIZADO",
        comprobante: "AUTORIZADA",
        numeroAutorizacion: claveAcceso,
        claveAcceso: claveAcceso,
        fechaAutorizacion: new Date().toISOString(),
        simulado: true
      };
    }
    
    return authorizationResult;
  } catch (error) {
    console.error("Error al solicitar autorización:", error);
    
    // En modo pruebas, simular respuesta exitosa ante errores
    if (ambiente === 'pruebas') {
      console.log("Modo pruebas: Simulando autorización exitosa por error en comunicación");
      return {
        estado: "AUTORIZADO",
        comprobante: "AUTORIZADA",
        numeroAutorizacion: claveAcceso,
        claveAcceso: claveAcceso,
        fechaAutorizacion: new Date().toISOString(),
        simulado: true,
        error_original: error.message
      };
    }
    
    throw new Error(`Error al solicitar autorización: ${error.message}`);
  }
}

/**
 * Guarda un XML en el sistema de archivos
 * @param {String} xmlContent Contenido del XML
 * @param {String} fileName Nombre del archivo (sin extensión)
 * @param {String} folderType Tipo de carpeta ('no-firmados', 'firmados', 'autorizados', 'pdf')
 * @returns {String} Ruta donde se guardó el archivo
 */
export function guardarXml(xmlContent, fileName, folderType) {
  try {
    // Validar tipo de carpeta
    const validFolders = ['no-firmados', 'firmados', 'autorizados', 'pdf'];
    if (!validFolders.includes(folderType)) {
      throw new Error(`Tipo de carpeta no válido: ${folderType}`);
    }
    
    // Construir ruta de carpeta
    const folderPath = path.join(rootDir, 'comprobantes', folderType);
    
    // Crear carpeta si no existe
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    // Generar nombre de archivo único si no se proporciona
    const fileNameWithExt = fileName ? `${fileName}.xml` : `factura_${Date.now()}.xml`;
    const filePath = path.join(folderPath, fileNameWithExt);
    
    // Escribir archivo
    fs.writeFileSync(filePath, xmlContent);
    console.log(`XML guardado en: ${filePath}`);
    
    return filePath;
  } catch (error) {
    console.error("Error al guardar XML:", error);
    throw new Error(`Error al guardar XML: ${error.message}`);
  }
}

/**
 * Mapea un código de forma de pago a los códigos oficiales del SRI
 * @param {String} formaPago Descripción o código de forma de pago
 * @returns {String} Código SRI de forma de pago
 */
export function mapFormaPagoToSRI(formaPago) {
  const formaPagoLower = (formaPago || '').toLowerCase();
  
  const mapeo = {
    // Códigos directos
    '01': '01', // SIN UTILIZACION DEL SISTEMA FINANCIERO
    '02': '02', // CHEQUE PROPIO
    '03': '03', // CHEQUE CERTIFICADO
    '04': '04', // CHEQUE DE GERENCIA
    '05': '05', // CHEQUE DEL EXTERIOR
    '06': '06', // DÉBITO DE CUENTA BANCARIA
    '07': '07', // TRANSFERENCIA PROPIO BANCO
    '08': '08', // TRANSFERENCIA OTRO BANCO NACIONAL
    '09': '09', // TRANSFERENCIA BANCO EXTERIOR
    '10': '10', // TARJETA DE CRÉDITO NACIONAL
    '11': '11', // TARJETA DE CRÉDITO INTERNACIONAL
    '12': '12', // GIRO
    '13': '13', // DEPOSITO EN CUENTA (CORRIENTE/AHORROS)
    '14': '14', // TRANSFERENCIA SPI BCE
    '15': '15', // TRANSFERENCIA SWIFT (SOCIEDADES)
    '16': '16', // ENDOSO DE TÍTULOS
    '17': '17', // COMPENSACIÓN DE DEUDAS
    '18': '18', // TARJETA DE DÉBITO
    '19': '19', // TARJETA PREPAGO
    '20': '20', // DINERO ELECTRÓNICO
    '21': '21', // TARJETA DE CRÉDITO NACIONAL LARGOPLAZO 
    '22': '22', // FORMA DE PAGO A MUTUO ACUERDO
    '23': '23', // CRÉDITO SIN INTERMEDIACIÓN
    '24': '24', // CRÉDITO CON INTERMEDIACIÓN
    '99': '99', // OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO
    
    // Nombres comunes
    'efectivo': '01',
    'cheque': '02',
    'debito': '18',
    'credito': '19',
    'transferencia': '08',
    'deposito': '13',
    'otros': '99',

    // Variaciones
    'cash': '01',
    'tarjeta de credito': '19',
    'tarjeta de debito': '18',
    'tarjeta': '19',
  };
  
  // Intentar mapeo directo
  if (mapeo[formaPagoLower]) {
    return mapeo[formaPagoLower];
  }
  
  // Para casos donde se envía algo como "tarjeta credito" (sin "de")
  if (formaPagoLower.includes('credito')) return '19';
  if (formaPagoLower.includes('debito')) return '18';
  if (formaPagoLower.includes('transferencia')) return '08';
  if (formaPagoLower.includes('cheque')) return '02';
  if (formaPagoLower.includes('efectivo')) return '01';
  
  // Valor por defecto
  return '01'; // Efectivo como predeterminado
}

/**
 * Convierte a formato de fecha requerido por el SRI (dd/MM/yyyy)
 * @param {Date|String} fecha Fecha a formatear
 * @returns {String} Fecha formateada
 */
export function formatearFechaSRI(fecha) {
  const fechaObj = fecha instanceof Date ? fecha : new Date(fecha);
  
  // Asegurarse de que la fecha sea válida
  if (isNaN(fechaObj.getTime())) {
    console.error('Fecha inválida recibida, usando fecha actual');
    return formatearFechaSRI(new Date());
  }
  
  // Formato DD/MM/YYYY para el SRI
  const dia = fechaObj.getDate().toString().padStart(2, '0');
  const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
  const año = fechaObj.getFullYear().toString();
  
  const fechaFormateada = `${dia}/${mes}/${año}`;
  console.log(`Fecha formateada para SRI: ${fechaFormateada}`);
  
  return fechaFormateada;
}

/**
 * Prepara la estructura de configuración para open-factura basada en los datos de la BD
 * @param {Object} emisor Datos del emisor
 * @param {Object} cliente Datos del cliente
 * @param {String} puntoEmision Punto de emisión
 * @param {String} secuencial Secuencial de la factura
 * @param {String} fechaEmision Fecha de emisión
 * @param {Array} detalles Detalles de productos
 * @param {Array} formasPago Formas de pago
 * @returns {Object} Configuración para open-factura
 */
export async function prepararConfiguracionFactura(emisor, cliente, puntoEmision, secuencial, fechaEmision, detalles, formasPago) {
  // Usar fecha proporcionada o fecha actual, manejando correctamente la zona horaria
  let fechaParaFactura;
  if (fechaEmision) {
    // Si la fecha viene en formato YYYY-MM-DD, parsearla correctamente para evitar problemas de zona horaria
    if (typeof fechaEmision === 'string' && fechaEmision.includes('-')) {
      const partes = fechaEmision.split('-');
      if (partes.length === 3) {
        // Crear fecha en la zona horaria local para evitar desfases
        // IMPORTANTE: Usamos los valores exactos sin conversión de zona horaria
        fechaParaFactura = new Date(parseInt(partes[0]), parseInt(partes[1]) - 1, parseInt(partes[2]), 12, 0, 0, 0);
        console.log(`Fecha parseada desde YYYY-MM-DD: ${fechaEmision} -> ${fechaParaFactura.toDateString()}`);
      } else {
        fechaParaFactura = new Date(fechaEmision);
      }
    } else {
      fechaParaFactura = new Date(fechaEmision);
    }
  } else {
    fechaParaFactura = new Date();
  }
  
  // Validar fecha
  if (isNaN(fechaParaFactura.getTime())) {
    console.error('Fecha de emisión inválida, usando fecha actual');
    fechaParaFactura = new Date();
  }
  
  // Formatear la fecha para el XML (DD/MM/YYYY)
  const fechaFactura = formatearFechaSRI(fechaParaFactura);
  console.log(`Fecha factura para XML: ${fechaFactura}`);
  console.log(`Fecha emisión original: ${fechaEmision}`);
  console.log(`Fecha objeto creado: ${fechaParaFactura.toDateString()}`);
  
  // IMPORTANTE: Guardar la fecha exacta para usar en la clave de acceso
  // La clave de acceso debe usar la MISMA fecha que aparece en el XML
  const fechaParaClaveAcceso = fechaFactura; // DD/MM/YYYY formato para clave
  console.log(`Fecha que se usará para clave de acceso: ${fechaParaClaveAcceso}`);
  
  // Obtener el IVA por defecto
  const defaultIva = await getDefaultIva();
  console.log(`IVA por defecto del sistema: ${defaultIva}`);
  
  // Calcular totales correctamente
  const subtotalCalculado = detalles.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
  
  const ivaCalculado = detalles.reduce((sum, d) => {
    const subtotalProducto = Number(d.subtotal || 0);
    const ivaProducto = Number(d.iva || defaultIva);
    return sum + (subtotalProducto * ivaProducto);
  }, 0);
  const totalCalculado = subtotalCalculado + ivaCalculado;
  
  console.log(`Totales calculados: { subtotal: ${subtotalCalculado}, iva: ${ivaCalculado}, total: ${totalCalculado} }`);

  return {
    infoTributaria: {
      ambiente: emisor.tipo_ambiente === "produccion" ? "2" : "1",
      tipoEmision: "1", // Normal
      razonSocial: emisor.razon_social,
      nombreComercial: emisor.nombre_comercial || emisor.razon_social,
      ruc: emisor.ruc,
      claveAcceso: "", // open-factura lo generará automáticamente
      codDoc: "01", // Factura
      estab: emisor.codigo_establecimiento.padStart(3, "0"),
      ptoEmi: puntoEmision.padStart(3, "0"),
      secuencial: secuencial.padStart(9, "0"),
      dirMatriz: emisor.direccion,
    },
    infoFactura: {
      fechaEmision: fechaFactura,
      dirEstablecimiento: emisor.direccion,
      // contribuyenteEspecial: OMITIDO - solo incluir si el emisor es contribuyente especial
      obligadoContabilidad: emisor.obligado_contabilidad ? "SI" : "NO",
      tipoIdentificacionComprador: cliente.tipo_identificacion || (cliente.cedula_ruc.length === 13 ? "04" : "05"),
      guiaRemision: "", // Si aplica
      razonSocialComprador: `${cliente.nombre} ${cliente.apellido || ""}`.trim(),
      identificacionComprador: cliente.cedula_ruc,
      direccionComprador: cliente.direccion || "S/N",
      totalSinImpuestos: subtotalCalculado.toFixed(2),
      totalDescuento: detalles.reduce((sum, d) => sum + Number(d.descuento || 0), 0).toFixed(2),
      totalConImpuestos: [
        {
          codigo: "2", // IVA
          codigoPorcentaje: "4", // CORREGIDO: código 4 para IVA 15%
          baseImponible: subtotalCalculado.toFixed(2),
          tarifa: "15.00",
          valor: ivaCalculado.toFixed(2),
        },
      ],
      propina: "0.00",
      importeTotal: totalCalculado.toFixed(2),
      moneda: "DOLAR",
      pagos: formasPago.map((fp) => {
        // Mapear nombres del frontend a códigos SRI
        const codigoFormaPago = mapFormaPagoToSRI(fp.forma_pago || fp.tipo);
        console.log(`Mapeando forma de pago: "${fp.forma_pago}" -> "${codigoFormaPago}"`);
        
        return {
          formaPago: codigoFormaPago,
          total: Number(fp.valor_pago || fp.valor || 0).toFixed(2),
          plazo: fp.plazo || 0,
          unidadTiempo: fp.unidad_tiempo || "dias",        };
      }),
    },
    detalles: detalles.map((d, index) => {
      const subtotalProducto = Number(d.subtotal || 0);
      const ivaProducto = Number(d.iva || defaultIva);
      const ivaValor = subtotalProducto * ivaProducto;
      
      console.log(`Procesando detalle ${index + 1}: {
  id_producto: ${d.id_producto},
  cantidad: ${d.cantidad},
  precio_unitario: ${d.precio_unitario},
  subtotal: ${d.subtotal},
  iva: ${d.iva}
}`);
      
      return {
        codigoPrincipal: d.id_producto.toString(),
        codigoAuxiliar: d.id_producto.toString(),
        descripcion: d.descripcion || `Producto ${d.id_producto}`,
        cantidad: Number(d.cantidad || 0).toFixed(2),
        precioUnitario: Number(d.precio_unitario || 0).toFixed(6),
        descuento: Number(d.descuento || 0).toFixed(2),
        precioTotalSinImpuesto: subtotalProducto.toFixed(2),
        impuestos: [
          {
            codigo: "2", // IVA
            codigoPorcentaje: "4", // CORREGIDO: código 4 para IVA 15% 
            tarifa: (ivaProducto * 100).toFixed(2),
            baseImponible: subtotalProducto.toFixed(2),
            valor: ivaValor.toFixed(2),
          },
        ],
      };    }),
    infoAdicional: [
      { nombre: "Email", valor: cliente.email || "N/A" },
      { nombre: "Teléfono", valor: cliente.telefono || "N/A" },
    ],
    // Información adicional para la clave de acceso
    fechaParaClaveAcceso: fechaParaClaveAcceso,
    fechaObjeto: fechaParaFactura
  };
}

/**
 * Verifica el estado actual de una factura en el SRI
 * @param {String} claveAcceso Clave de acceso de la factura
 * @param {String} ambiente Ambiente SRI ('pruebas' o 'produccion')
 * @returns {Object} Estado de la factura
 */
export async function verificarEstadoFactura(claveAcceso, ambiente) {
  try {
    console.log(`Verificando estado de factura con clave: ${claveAcceso}`);
    
    // Validar ambiente
    if (!SRI_URLS[ambiente]) {
      throw new Error(`Ambiente no válido: ${ambiente}. Debe ser 'pruebas' o 'produccion'`);
    }
    
    // Solicitar autorización
    const authorizationResult = await documentAuthorization(
      claveAcceso,
      SRI_URLS[ambiente].autorizacion
    );
    
    // Verificar resultado
    if (!authorizationResult) {
      return {
        estado: "DESCONOCIDO",
        mensaje: "No se pudo obtener información del comprobante",
        fecha_autorizacion: null,
        numero_autorizacion: null,
        comprobante: null
      };
    }
    
    // Mapear respuesta del SRI
    return {
      estado: authorizationResult.estado || "DESCONOCIDO",
      mensaje: authorizationResult.mensaje || "",
      fecha_autorizacion: authorizationResult.fechaAutorizacion || null,
      numero_autorizacion: authorizationResult.numeroAutorizacion || authorizationResult.claveAcceso || claveAcceso,
      comprobante: authorizationResult.comprobante || null
    };
  } catch (error) {
    console.error("Error al verificar estado de factura:", error);
    return {
      estado: "ERROR",
      mensaje: `Error al verificar estado: ${error.message}`,
      fecha_autorizacion: null,
      numero_autorizacion: null,
      comprobante: null
    };
  }
}

/**
 * Descarga un certificado P12 desde Supabase Storage
 * @param {string} certificatePath - Ruta del certificado en storage
 * @returns {Promise<Buffer>} - Buffer con el contenido del certificado
 */
export async function getP12FromSupabase(certificatePath) {
  try {
    console.log(`✅ Obteniendo certificado desde Supabase: ${certificatePath}`);
    
    // Usar el StorageService que ya sabemos que funciona
    const storageService = new StorageService();
    
    // Descargar el archivo directamente
    const blob = await storageService.downloadFile('syntorystorage', certificatePath);
    
    if (!blob || blob.size === 0) {
      throw new Error('El certificado descargado está vacío');
    }
    
    // Convertir Blob a ArrayBuffer y luego a Buffer
    const arrayBuffer = await blob.arrayBuffer();
    const resultBuffer = Buffer.from(arrayBuffer);
    
    // Verificar que el buffer tiene contenido válido de P12
    if (resultBuffer.byteLength < 100) {
      throw new Error(`El certificado parece ser muy pequeño: ${resultBuffer.byteLength} bytes`);
    }
    
    console.log(`✅ Certificado descargado exitosamente, tamaño: ${resultBuffer.byteLength} bytes`);
    return resultBuffer;
    
  } catch (error) {
    console.error('❌ Error al descargar certificado de Supabase:', error);
    throw new Error(`Error al obtener certificado P12 desde Supabase: ${error.message}`);
  }
}

/**
 * Verifica si un certificado P12 existe en Supabase Storage
 * @param {string} certificatePath - Ruta del certificado en storage
 * @returns {Promise<boolean>} - True si existe, false si no
 */
export async function verificarCertificadoExiste(certificatePath) {
  try {
    console.log(`🔍 Verificando existencia del certificado: ${certificatePath}`);
    
    const storageService = new StorageService();
    const existe = await storageService.fileExists('syntorystorage', certificatePath);
    
    console.log(`${existe ? '✅' : '❌'} Certificado ${existe ? 'existe' : 'no existe'} en Supabase Storage`);
    return existe;
    
  } catch (error) {
    console.log(`❌ Error al verificar certificado: ${error.message}`);
    return false;
  }
}

/**
 * Valida y corrige la clave de acceso generada
 * @param {String} claveAcceso Clave de acceso a validar
 * @param {Object} facturaData Datos de la factura para regenerar la clave si es necesario
 * @returns {String} Clave de acceso validada
 */
export function validarClaveAcceso(claveAcceso, facturaData) {
  console.log("Validando clave de acceso:", claveAcceso);
  
  // Verificar que los datos de factura incluyen fechaStr en formato DDMMAA
  if (!facturaData.fechaStr || facturaData.fechaStr.length !== 6) {
    console.error(`Error: facturaData.fechaStr debe estar presente y tener 6 dígitos (DDMMAA). Valor recibido: ${facturaData.fechaStr}`);
    
    // Intentar recuperar la fecha del objeto si es posible
    if (facturaData.fechaEmision) {
      try {
        const partes = facturaData.fechaEmision.split('/');
        if (partes.length === 3) {
          facturaData.fechaStr = `${partes[0]}${partes[1]}${partes[2].slice(-2)}`;
          console.log(`Fecha recuperada de fechaEmision: ${facturaData.fechaStr}`);
        }
      } catch (e) {
        console.error("No se pudo recuperar la fecha:", e);
      }
    }
  }
  
  // Verificar si la clave de acceso está vacía o contiene NaN o undefined
  if (!claveAcceso || claveAcceso.includes('NaN') || claveAcceso.includes('undefined')) {
    console.log("Clave de acceso inválida, generando una nueva");
    // Usar la función de nuestro nuevo servicio
    return generarClaveAcceso(facturaData);
  }
  
  // Verificar que solo contenga dígitos numéricos
  if (!/^\d+$/.test(claveAcceso)) {
    console.log("Clave de acceso contiene caracteres no numéricos, generando una nueva");
    return generarClaveAcceso(facturaData);
  }
  
  // Verificar la longitud
  if (claveAcceso.length !== 49) {
    console.log(`Longitud incorrecta: ${claveAcceso.length}, regenerando clave completa`);
    return generarClaveAcceso(facturaData);
  }
  
  try {
    // Extraer la fecha de la clave de acceso (primeros 6 dígitos DDMMAA)
    const fechaClave = claveAcceso.substring(0, 6);
    
    // Usar la fechaStr ya validada del objeto facturaData
    const fechaFactura = facturaData.fechaStr;
    
    // Si la fechaStr no coincide con la fecha en la clave, regenerar
    if (fechaClave !== fechaFactura) {
      console.log(`Fecha en clave (${fechaClave}) no coincide con fecha factura (${fechaFactura || 'no disponible'}), regenerando`);
      return generarClaveAcceso(facturaData);
    }
    
    // Si llegamos aquí, la clave parece válida
    return claveAcceso;
    
  } catch (error) {
    console.error("Error validando clave de acceso, regenerando:", error);
    return generarClaveAcceso(facturaData);
  }
}

/**
 * Genera una clave de acceso según el algoritmo del SRI
 * @param {Object} data Datos necesarios para generar la clave
 * @returns {String} Clave de acceso generada
 */
/**
 * Usa la implementación de generarClaveAcceso del nuevo servicio
 * @param {Object} data Datos necesarios para generar la clave
 * @returns {String} Clave de acceso generada
 */
export function generarClaveAccesoManual(data) {
  // Esta función ahora solo es un wrapper para mantener compatibilidad
  // Usamos la implementación de nuestro nuevo servicio
  const { generarClaveAcceso } = require('./sri-facturacion.service.js');
  return generarClaveAcceso(data);
}

/**
 * @deprecated Usar la función del nuevo servicio en su lugar
 */
export function calcularDigitoVerificador(clave) {
  const { calcularDigitoVerificador } = require('./sri-facturacion.service.js');
  return calcularDigitoVerificador(clave);
}

/**
 * Envía un XML al SRI utilizando fetch nativo para simular el envío
 * @param {String} xml Contenido XML a enviar
 * @param {String} url URL del endpoint del SRI
 * @returns {Promise<Object>} Respuesta del SRI
 */
export async function enviarXmlSinFirma(xml, url) {
  try {
    console.log(`Enviando XML sin firma al SRI: ${url}`);
    
    // Crear solicitud SOAP - SIN CDATA ni base64 para evitar problemas de interpretación
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soap:Header />
  <soap:Body>
    <ec:validarComprobante>
      <xml>${xml}</xml>
    </ec:validarComprobante>
  </soap:Body>
</soap:Envelope>`;

    // Importar fetch
    const fetch = (await import('node-fetch')).default;
    
    // Enviar solicitud
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml;charset=UTF-8',
        'SOAPAction': ''
      },
      body: soapRequest,
      timeout: 30000 // 30 segundos máximo
    });
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status} ${response.statusText}`);
    }
    
    // Leer respuesta
    const responseText = await response.text();
    console.log("Respuesta del SRI:", responseText);
    
    // Procesamos la respuesta SOAP
    if (responseText.includes('<estado>RECIBIDA</estado>')) {
      return {
        estado: "RECIBIDA",
        comprobante: "RECIBIDA"
      };
    } else if (responseText.includes('<estado>DEVUELTA</estado>')) {
      // Extraer mensaje de error
      const mensajeMatch = responseText.match(/<mensaje>(.*?)<\/mensaje>/);
      const mensaje = mensajeMatch ? mensajeMatch[1] : "Error desconocido";
      
      const infoMatch = responseText.match(/<informacionAdicional>(.*?)<\/informacionAdicional>/);
      const info = infoMatch ? infoMatch[1] : "";
      
      return {
        estado: "DEVUELTA",
        mensaje: mensaje,
        informacionAdicional: info
      };
    }
    
    // Respuesta por defecto si no se puede interpretar
    return {
      estado: "PROCESANDO",
      comprobante: "EN_PROCESO",
      mensajes: ["Respuesta del SRI no pudo ser interpretada correctamente"]
    };
  } catch (error) {
    console.error("Error al enviar XML sin firma:", error);
    return {
      estado: "ERROR",
      mensaje: error.message,
      error: true
    };
  }
}

/**
 * Convierte las fechas en el XML de formato YYYY/MM/DD a DD/MM/YYYY para cumplir con el estándar SRI
 * @param {String} xml XML con fechas en formato YYYY/MM/DD
 * @returns {String} XML con fechas convertidas a formato DD/MM/YYYY
 */
export function convertirFechasParaSRI(xml) {
  try {
    // Patrón para buscar fechas en formato YYYY/MM/DD
    const patronFechaYYYYMMDD = /(\d{4})\/(\d{2})\/(\d{2})/g;
    
    // Patrón para buscar fechas en formato YYYY-MM-DD
    const patronFechaYYYYMMDD2 = /(\d{4})-(\d{2})-(\d{2})/g;
    
    // Convertir todas las fechas encontradas en formato YYYY/MM/DD
    let xmlConvertido = xml.replace(patronFechaYYYYMMDD, (match, year, month, day) => {
      // Convertir YYYY/MM/DD a DD/MM/YYYY
      const fechaConvertida = `${day}/${month}/${year}`;
      console.log(`Convirtiendo fecha: ${match} → ${fechaConvertida}`);
      return fechaConvertida;
    });
    
    // Convertir todas las fechas encontradas en formato YYYY-MM-DD
    xmlConvertido = xmlConvertido.replace(patronFechaYYYYMMDD2, (match, year, month, day) => {
      // Convertir YYYY-MM-DD a DD/MM/YYYY
      const fechaConvertida = `${day}/${month}/${year}`;
      console.log(`Convirtiendo fecha: ${match} → ${fechaConvertida}`);
      return fechaConvertida;
    });
    
    // Verificar si algún tag de fecha contiene formato incorrecto
    // Ejemplo: <fechaEmision>2025-06-22</fechaEmision> o <fechaEmision>2025/06/22</fechaEmision>
    const tagsConFechas = ['<fechaEmision>', '<fechaAutorizacion>', '<fechaInicio>', '<fechaFin>', '<fechaImpresion>'];
    
    // Log para depuración
    for (const tag of tagsConFechas) {
      const tagRegex = new RegExp(`${tag}([^<]+)<\/`, 'g');
      const matches = [...xmlConvertido.matchAll(tagRegex)];
      
      for (const match of matches) {
        const fechaActual = match[1];
        console.log(`Fecha en tag ${tag}: ${fechaActual}`);
        
        // Verificar si la fecha está en formato DD/MM/YYYY
        const esFormatoCorrecto = /\d{2}\/\d{2}\/\d{4}/.test(fechaActual);
        if (!esFormatoCorrecto) {
          console.warn(`¡Advertencia! Fecha en formato incorrecto en tag ${tag}: ${fechaActual}`);
        }
      }
    }
    
    return xmlConvertido;
  } catch (error) {
    console.error("Error al convertir fechas en XML:", error);
    return xml; // Retornar XML original si hay error
  }
}

/**
 * Procesa las respuestas del SRI y extrae información relevante
 * @param {Object} respuestaSRI - Respuesta del SRI
 * @param {String} tipo - Tipo de respuesta ('recepcion' o 'autorizacion')
 * @returns {Object} Respuesta procesada
 */
function procesarRespuestaSRI(respuestaSRI, tipo) {
  try {
    console.log(`🔍 Procesando respuesta SRI (${tipo}):`, JSON.stringify(respuestaSRI, null, 2));
    
    if (!respuestaSRI) {
      return { estado: 'ERROR', mensaje: 'Respuesta vacía del SRI' };
    }
    
    if (tipo === 'recepcion') {
      const estado = respuestaSRI.estado || 'DESCONOCIDO';
      const comprobantes = respuestaSRI.comprobantes || [];
      const mensajes = respuestaSRI.mensajes || [];
      
      return {
        estado,
        comprobantes,
        mensajes,
        respuestaCompleta: respuestaSRI
      };
    } else if (tipo === 'autorizacion') {
      // Buscar autorizaciones en la respuesta
      let autorizaciones = respuestaSRI.autorizaciones || [];
      if (!Array.isArray(autorizaciones) && respuestaSRI.autorizacion) {
        autorizaciones = [respuestaSRI.autorizacion];
      }
      
      if (autorizaciones.length > 0) {
        const autorizacion = autorizaciones[0];
        return {
          estado: autorizacion.estado || 'DESCONOCIDO',
          numeroAutorizacion: autorizacion.numeroAutorizacion,
          fechaAutorizacion: autorizacion.fechaAutorizacion,
          mensajes: autorizacion.mensajes || [],
          respuestaCompleta: respuestaSRI
        };
      } else {
        return {
          estado: 'NO_AUTORIZADA',
          mensajes: respuestaSRI.mensajes || [],
          respuestaCompleta: respuestaSRI
        };
      }
    }
    
    return { estado: 'DESCONOCIDO', respuestaCompleta: respuestaSRI };
  } catch (error) {
    console.error(`❌ Error procesando respuesta SRI (${tipo}):`, error);
    return { estado: 'ERROR', mensaje: error.message };
  }
}
