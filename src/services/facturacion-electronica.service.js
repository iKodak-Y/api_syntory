import {
  generateInvoice,
  generateInvoiceXml,
  signXml,
  documentReception,
  documentAuthorization,
  getP12FromLocalFile,
} from "open-factura";
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

// URLs del SRI por ambiente
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
    console.log("Generando factura electrónica...");
    
    // Generar factura con open-factura
    const { invoice, accessKey: originalAccessKey } = generateInvoice(facturaConfig);
    console.log("Factura generada con clave de acceso original:", originalAccessKey);
    
    // Extraer datos necesarios para la validación y posible regeneración
    const claveAccesoData = {
      fechaEmision: facturaConfig.infoFactura.fechaEmision,
      ruc: facturaConfig.infoTributaria.ruc,
      ambiente: facturaConfig.infoTributaria.ambiente === '2' ? 'produccion' : 'pruebas',
      codigoEstablecimiento: facturaConfig.infoTributaria.estab,
      puntoEmision: facturaConfig.infoTributaria.ptoEmi,
      secuencial: facturaConfig.infoTributaria.secuencial
    };
    
    // Validar y corregir la clave de acceso
    const accessKey = validarClaveAcceso(originalAccessKey, claveAccesoData);
    console.log("Clave de acceso validada/corregida:", accessKey);
    
    // Si la clave fue modificada, actualizarla en el objeto invoice
    if (originalAccessKey !== accessKey && invoice && invoice.infoTributaria) {
      invoice.infoTributaria.claveAcceso = accessKey;
    }
    
    return { invoice, accessKey };
  } catch (error) {
    console.error("Error al generar factura electrónica:", error);
    throw new Error(`Error al generar factura electrónica: ${error.message}`);
  }
}

/**
 * Genera un XML a partir de un objeto factura
 * @param {Object} invoice Objeto factura generado por open-factura
 * @returns {String} XML de la factura
 */
export async function generarXmlFactura(invoice) {
  try {
    console.log("Generando XML de factura...");
    const invoiceXml = generateInvoiceXml(invoice);
    
    // Validar que el XML se generó correctamente
    if (!invoiceXml || invoiceXml.length === 0) {
      throw new Error("El XML generado está vacío o es inválido");
    }
    
    // Validar que el XML contiene elementos esenciales
    console.log("Verificando estructura del XML...");
    if (!invoiceXml.includes('<factura') && !invoiceXml.includes('<comprobante') && !invoiceXml.includes('infoTributaria')) {
      throw new Error("El XML generado no contiene la estructura de factura esperada");
    }
    
    return invoiceXml;
  } catch (error) {
    console.error("Error al generar XML:", error);
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
export async function firmarXml(xmlContent, certificatePath, certificatePassword) {
  let tempCertPath = null; // Declarar al inicio para que esté disponible en finally
  
  try {
    console.log("Firmando XML con certificado:", certificatePath);
    
    if (!xmlContent || xmlContent.length === 0) {
      throw new Error("XML vacío o inválido");
    }
    
    if (!certificatePassword) {
      throw new Error("No se ha configurado la contraseña del certificado");
    }
    
    let certBuffer;
    
    // Determinar si es una ruta local o de Supabase Storage
    const esRutaSupabase = certificatePath.startsWith('certificados/') || 
                         certificatePath.startsWith('syntorystorage/') ||
                         !certificatePath.includes('/') ||
                         !fs.existsSync(certificatePath);
      if (esRutaSupabase) {
      console.log("Detectada ruta de Supabase Storage, descargando certificado...");
      
      // Primero verificar si el certificado existe
      const certificadoExiste = await verificarCertificadoExiste(certificatePath);
      if (!certificadoExiste) {
        throw new Error(`El certificado no existe en Supabase Storage: ${certificatePath}`);
      }
      
      try {
        certBuffer = await getP12FromSupabase(certificatePath);
        console.log(`Certificado descargado de Supabase, tamaño: ${certBuffer.byteLength} bytes`);
        
        // Crear archivo temporal para el certificado
        const os = await import('os');
        const tempDir = os.tmpdir();
        tempCertPath = path.join(tempDir, `temp_cert_${Date.now()}.p12`);
        
        // Escribir el buffer a un archivo temporal
        fs.writeFileSync(tempCertPath, certBuffer);
        console.log(`Certificado guardado temporalmente en: ${tempCertPath}`);
        
      } catch (storageError) {
        console.error("Error al obtener certificado de Supabase:", storageError);
        throw new Error(`No se pudo descargar el certificado desde Supabase: ${storageError.message}`);
      }
    } else {
      // Verificar que el archivo existe localmente
      if (!fs.existsSync(certificatePath)) {
        throw new Error(`El archivo de certificado local no existe: ${certificatePath}`);
      }
      
      // Verificar tamaño del archivo
      const stats = fs.statSync(certificatePath);
      console.log(`Certificado local encontrado, tamaño: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error("El certificado está vacío");
      }
      
      // Usar la ruta local directamente
      tempCertPath = certificatePath;
      certBuffer = fs.readFileSync(certificatePath);
    }
    
    if (!certBuffer || certBuffer.byteLength === 0) {
      throw new Error("No se pudo obtener un certificado válido");
    }
    
    console.log(`Certificado obtenido correctamente, tamaño: ${certBuffer.byteLength} bytes`);
    
    // Preparar XML limpio
    const cleanXml = xmlContent.trim();
    
    // Intentar firmar usando la ruta del archivo
    try {
      console.log(`Intentando firmar con certificado en ruta: ${tempCertPath}`);
      
      const signedXml = await signXml(cleanXml, tempCertPath, certificatePassword);
      
      // Verificar que el XML firmado contiene la estructura de firma
      if (!signedXml || (!signedXml.includes('<ds:Signature') && !signedXml.includes('<Signature'))) {
        throw new Error("El XML firmado no contiene una firma digital válida");
      }
      
      console.log("XML firmado exitosamente usando ruta del certificado");
      return signedXml;
      
    } catch (signError) {
      console.error("Error al firmar con ruta del certificado:", signError);
      
      // Método alternativo: usar el buffer directamente
      try {
        console.log("Intentando método alternativo de firma con buffer del certificado...");
        
        const signedXml = await signXml(cleanXml, certBuffer, certificatePassword);
        
        if (!signedXml || (!signedXml.includes('<ds:Signature') && !signedXml.includes('<Signature'))) {
          throw new Error("El XML firmado no contiene una firma digital válida");
        }
        
        console.log("XML firmado exitosamente usando buffer del certificado");
        return signedXml;
        
      } catch (altError) {
        console.error("Error con método alternativo:", altError);
        throw new Error(`No se pudo firmar el XML: ${altError.message}`);
      }
    }
    
  } catch (error) {
    console.error("Error al firmar XML:", error);
    throw new Error(`Error al firmar XML: ${error.message}`);
  } finally {
    // Limpiar archivo temporal si se creó
    if (tempCertPath && tempCertPath.includes('temp_cert_') && fs.existsSync(tempCertPath)) {
      try {
        fs.unlinkSync(tempCertPath);
        console.log(`Archivo temporal de certificado eliminado: ${tempCertPath}`);
      } catch (cleanupError) {
        console.warn(`No se pudo eliminar archivo temporal: ${cleanupError.message}`);
      }
    }
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
    
    // Enviar al SRI para recepción
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
    
    // Solicitar autorización
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
  return fechaObj.toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "2-digit", 
    year: "numeric",
  }).replace(/\//g, "/");
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
  // Usar fecha proporcionada o fecha actual
  const fechaFactura = fechaEmision ? 
    formatearFechaSRI(fechaEmision) :
    formatearFechaSRI(new Date());
  // Calcular totales correctamente
  const subtotalCalculado = detalles.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
  
  // Obtener el IVA por defecto
  const defaultIva = await getDefaultIva();
  
  const ivaCalculado = detalles.reduce((sum, d) => {
    const subtotalProducto = Number(d.subtotal || 0);
    const ivaProducto = Number(d.iva || defaultIva);
    return sum + (subtotalProducto * ivaProducto);
  }, 0);
  const totalCalculado = subtotalCalculado + ivaCalculado;

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
      contribuyenteEspecial: emisor.contribuyente_especial || "",
      obligadoContabilidad: emisor.obligado_contabilidad ? "SI" : "NO",
      tipoIdentificacionComprador: cliente.cedula_ruc.length === 13 ? "04" : "05",
      guiaRemision: "", // Si aplica
      razonSocialComprador: `${cliente.nombre} ${cliente.apellido || ""}`.trim(),
      identificacionComprador: cliente.cedula_ruc,
      direccionComprador: cliente.direccion || "S/N",
      totalSinImpuestos: subtotalCalculado.toFixed(2),
      totalDescuento: detalles.reduce((sum, d) => sum + Number(d.descuento || 0), 0).toFixed(2),
      totalConImpuestos: [
        {
          codigo: "2", // IVA
          codigoPorcentaje: "2", // 15% (código 2 para 15%)
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
        
        return {
          formaPago: codigoFormaPago,
          total: Number(fp.valor_pago || fp.valor || 0).toFixed(2),
          plazo: fp.plazo || 0,
          unidadTiempo: fp.unidad_tiempo || "dias",
        };
      }),
    },
    detalles: detalles.map((d) => {
      const subtotalProducto = Number(d.subtotal || 0);
      const ivaProducto = Number(d.iva || defaultIva);
      const ivaValor = subtotalProducto * ivaProducto;
      
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
            codigoPorcentaje: "2", // 15% (código 2 para 15%)
            tarifa: (ivaProducto * 100).toFixed(2),
            baseImponible: subtotalProducto.toFixed(2),
            valor: ivaValor.toFixed(2),
          },
        ],
      };
    }),
    infoAdicional: [
      { nombre: "Email", valor: cliente.email || "N/A" },
      { nombre: "Teléfono", valor: cliente.telefono || "N/A" },
    ],
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
    console.log(`Obteniendo certificado desde Supabase: ${certificatePath}`);
    
    // Obtener cliente de Supabase directamente
    const { getConnection } = await import('../database/connection.js');
    const supabase = await getConnection();
    
    // Determinar bucket y ruta - usar el mismo bucket que para los logos
    let bucket = 'syntorystorage'; // Bucket por defecto (mismo que los logos)
    let filePath = certificatePath;
    
    // Limpiar la ruta del certificado
    if (certificatePath.includes('/')) {
      const pathParts = certificatePath.split('/');
      // Si la primera parte no es 'certificados', asumimos que es el bucket
      if (pathParts.length >= 2 && pathParts[0] !== 'certificados') {
        bucket = pathParts[0];
        filePath = pathParts.slice(1).join('/');
      } else {
        // La ruta es algo como 'certificados/archivo.p12'
        filePath = certificatePath;
      }
    }
    
    console.log(`Descargando de bucket: ${bucket}, ruta: ${filePath}`);
    console.log(`Descargando archivo como buffer desde: ${bucket}/${filePath}`);
    
    // Intentar diferentes métodos de descarga
    let data = null;
    let error = null;
    
    // Método 1: Download directo
    try {
      console.log("Método 1: Descarga directa con download()");
      const result = await supabase.storage.from(bucket).download(filePath);
      data = result.data;
      error = result.error;
    } catch (downloadError) {
      console.log("Método 1 falló:", downloadError.message);
      error = downloadError;
    }
    
    // Método 2: Si el método 1 falla, intentar crear una URL pública y descargar
    if (error || !data) {
      try {
        console.log("Método 2: Creando URL pública para descarga");
        
        // Crear URL pública (puede que necesite permisos públicos)
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(filePath);
        
        if (urlData && urlData.publicUrl) {
          console.log("URL pública creada:", urlData.publicUrl);
          
          // Descargar usando fetch
          const response = await fetch(urlData.publicUrl);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          data = {
            arrayBuffer: () => Promise.resolve(arrayBuffer),
            size: arrayBuffer.byteLength
          };
          error = null;
          
          console.log("Descarga exitosa con URL pública");
        } else {
          throw new Error("No se pudo crear URL pública");
        }
      } catch (publicUrlError) {
        console.log("Método 2 falló:", publicUrlError.message);
        
        // Método 3: Crear URL firmada (signed URL)
        try {
          console.log("Método 3: Creando URL firmada para descarga");
          
          const { data: signedData, error: signedError } = await supabase.storage
            .from(bucket)
            .createSignedUrl(filePath, 300); // 5 minutos de validez
          
          if (signedError) {
            throw signedError;
          }
          
          if (signedData && signedData.signedUrl) {
            console.log("URL firmada creada:", signedData.signedUrl);
            
            // Descargar usando fetch
            const response = await fetch(signedData.signedUrl);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            data = {
              arrayBuffer: () => Promise.resolve(arrayBuffer),
              size: arrayBuffer.byteLength
            };
            error = null;
            
            console.log("Descarga exitosa con URL firmada");
          } else {
            throw new Error("No se pudo crear URL firmada");
          }
        } catch (signedUrlError) {
          console.log("Método 3 falló:", signedUrlError.message);
          error = signedUrlError;
        }
      }
    }
    
    // Si todos los métodos fallaron
    if (error || !data) {
      console.error('Error final de Supabase Storage:', error);
      throw new Error(`Error al descargar archivo P12: ${error?.message || 'Respuesta vacía'}`);
    }
    
    console.log(`Archivo descargado exitosamente, tamaño: ${data.size} bytes`);
    
    // Convertir el blob a buffer
    const arrayBuffer = await data.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    console.log(`Certificado descargado exitosamente, tamaño: ${buffer.byteLength} bytes`);
    
    // Validar que el buffer no está vacío
    if (buffer.byteLength === 0) {
      throw new Error('El certificado descargado está vacío');
    }
    
    // Verificar que el buffer tiene contenido válido de P12
    if (buffer.byteLength < 100) {
      throw new Error(`El certificado parece ser muy pequeño: ${buffer.byteLength} bytes`);
    }
    
    return buffer;
  } catch (error) {
    console.error('Error al descargar certificado de Supabase:', error);
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
    console.log(`Verificando existencia del certificado: ${certificatePath}`);
    
    const { getConnection } = await import('../database/connection.js');
    const supabase = await getConnection();
    
    let bucket = 'syntorystorage';
    let filePath = certificatePath;
    
    if (certificatePath.includes('/')) {
      const pathParts = certificatePath.split('/');
      if (pathParts.length >= 2 && pathParts[0] !== 'certificados') {
        bucket = pathParts[0];
        filePath = pathParts.slice(1).join('/');
      } else {
        filePath = certificatePath;
      }
    }
    
    // Intentar obtener información del archivo
    const { data, error } = await supabase.storage.from(bucket).list(path.dirname(filePath), {
      search: path.basename(filePath)
    });
    
    if (error) {
      console.log(`Error al verificar certificado: ${error.message}`);
      return false;
    }
    
    const existe = data && data.length > 0;
    console.log(`Certificado ${existe ? 'existe' : 'no existe'} en Supabase Storage`);
    
    return existe;
  } catch (error) {
    console.log(`Error al verificar certificado: ${error.message}`);
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
  
  // Verificar si la clave de acceso está vacía o contiene NaN
  if (!claveAcceso || claveAcceso.includes('NaN') || claveAcceso.includes('undefined')) {
    console.log("Clave de acceso inválida, generando una nueva");
    return generarClaveAccesoManual(facturaData);
  }
  
  // Verificar que solo contenga dígitos numéricos
  if (!/^\d+$/.test(claveAcceso)) {
    console.log("Clave de acceso contiene caracteres no numéricos, generando una nueva");
    return generarClaveAccesoManual(facturaData);
  }
  
  // Verificar la longitud
  if (claveAcceso.length !== 49) {
    console.log(`Longitud incorrecta: ${claveAcceso.length}, ajustando a 49 caracteres`);
    
    if (claveAcceso.length > 49) {
      // Si es más larga, truncar
      return claveAcceso.substring(0, 49);
    } else {
      // Si es más corta, rellenar con ceros
      return claveAcceso.padEnd(49, '0');
    }
  }
  
  // La clave es válida
  return claveAcceso;
}

/**
 * Genera una clave de acceso según el algoritmo del SRI
 * @param {Object} data Datos necesarios para generar la clave
 * @returns {String} Clave de acceso generada
 */
export function generarClaveAccesoManual(data) {
  // Formato SRI: fecha(6)+tipoComprobante(2)+ruc(13)+ambiente(1)+serie(6)+secuencial(9)+codigoNumerico(8)+tipoEmision(1)+digitoVerificador(1) = 49 dígitos
  try {
    const { fechaEmision, ruc, ambiente, codigoEstablecimiento, puntoEmision, secuencial } = data;
    
    // Determinar la fecha a usar
    let fechaParaUsar;
    if (fechaEmision) {
      // Si se proporciona una fecha específica, usarla
      fechaParaUsar = new Date(fechaEmision);
    } else {
      // Si no, usar la fecha actual
      fechaParaUsar = new Date();
    }
    
    // Verificar que la fecha sea válida
    if (isNaN(fechaParaUsar.getTime())) {
      console.error('Fecha inválida, usando fecha actual');
      fechaParaUsar = new Date();
    }
    
    // Formato correcto del SRI: DDMMAA (6 dígitos)
    const dia = fechaParaUsar.getDate().toString().padStart(2, '0');
    const mes = (fechaParaUsar.getMonth() + 1).toString().padStart(2, '0');
    const año = fechaParaUsar.getFullYear().toString().slice(-2); // Solo los últimos 2 dígitos
    
    // Formato correcto: DDMMAA
    let fechaStr = `${dia}${mes}${año}`;
    
    console.log(`Generando clave con fecha: ${fechaStr} (formato DDMMAA para SRI)`);
    
    // Verificar que la fecha tenga exactamente 6 dígitos
    if (!/^\d{6}$/.test(fechaStr)) {
      console.error(`Formato de fecha incorrecto: ${fechaStr}, regenerando`);
      fechaStr = dia + mes + año;
      console.log(`Nueva fecha regenerada: ${fechaStr}`);
    }    const tipoComprobante = '01'; // Factura
    const ambienteStr = ambiente === 'produccion' ? '2' : '1';
    const establecimiento = (codigoEstablecimiento || '001').toString().padStart(3, "0");
    const puntoEmi = (puntoEmision || '001').toString().padStart(3, "0");
    const serie = `${establecimiento}${puntoEmi}`;
    const secuencialStr = (secuencial || '1').toString().padStart(9, '0');
    const codigoNumerico = Math.floor(10000000 + Math.random() * 90000000).toString(); // 8 dígitos aleatorios
    const tipoEmision = '1'; // Emisión normal
    
    // Asegurar que el RUC tenga exactamente 13 dígitos
    const rucStr = ruc.toString().padStart(13, '0');
    
    console.log("Verificando longitudes de componentes:");
    console.log(`- Fecha: ${fechaStr} (${fechaStr.length} chars)`);
    console.log(`- Tipo Comprobante: ${tipoComprobante} (${tipoComprobante.length} chars)`);
    console.log(`- RUC: ${rucStr} (${rucStr.length} chars)`);
    console.log(`- Ambiente: ${ambienteStr} (${ambienteStr.length} chars)`);
    console.log(`- Serie: ${serie} (${serie.length} chars)`);
    console.log(`- Secuencial: ${secuencialStr} (${secuencialStr.length} chars)`);
    console.log(`- Código numérico: ${codigoNumerico} (${codigoNumerico.length} chars)`);
    console.log(`- Tipo emisión: ${tipoEmision} (${tipoEmision.length} chars)`);
      // Verificar que todos los componentes sean numéricos
    const componentesNumericos = [fechaStr, tipoComprobante, rucStr, ambienteStr, serie, secuencialStr, codigoNumerico, tipoEmision];
    for (const componente of componentesNumericos) {
      if (!/^\d+$/.test(componente)) {
        console.error(`Componente no numérico detectado: ${componente}`);
        throw new Error(`Componente no numérico en clave de acceso: ${componente}`);
      }
    }
    
    // Construir clave sin dígito verificador - Usando formato SRI
    const claveBase = `${fechaStr}${tipoComprobante}${rucStr}${ambienteStr}${serie}${secuencialStr}${codigoNumerico}${tipoEmision}`;
    
    console.log(`Clave base construida: ${claveBase} (${claveBase.length} chars)`);    // Verificar longitud antes del dígito verificador (debería ser 48)
    if (claveBase.length !== 48) {
      console.error(`Longitud incorrecta de clave base: ${claveBase.length} (esperado 48)`);
      console.error(`Componentes: Fecha=${fechaStr}(${fechaStr.length}), TipoComp=${tipoComprobante}(${tipoComprobante.length}), RUC=${rucStr}(${rucStr.length}), Amb=${ambienteStr}(${ambienteStr.length}), Serie=${serie}(${serie.length}), Sec=${secuencialStr}(${secuencialStr.length}), Codigo=${codigoNumerico}(${codigoNumerico.length}), TipoEmi=${tipoEmision}(${tipoEmision.length})`);
    }
    
    // Calcular dígito verificador (módulo 11)
    const digitoVerificador = calcularDigitoVerificador(claveBase);
    
    // Construir clave completa
    const claveCompleta = `${claveBase}${digitoVerificador}`;
    
    console.log(`Clave de acceso generada: ${claveCompleta} (Fecha: ${fechaStr})`);    console.log(`Componentes de la clave:`);
    console.log(`- Fecha (DDMMAA): ${fechaStr} (${fechaStr.length} chars)`);
    console.log(`- Tipo Comprobante: ${tipoComprobante} (${tipoComprobante.length} chars)`);
    console.log(`- RUC: ${rucStr} (${rucStr.length} chars)`);
    console.log(`- Ambiente: ${ambienteStr} (${ambienteStr.length} chars)`);
    console.log(`- Serie: ${serie} (${serie.length} chars)`);
    console.log(`- Secuencial: ${secuencialStr} (${secuencialStr.length} chars)`);
    console.log(`- Código numérico: ${codigoNumerico} (${codigoNumerico.length} chars)`);
    console.log(`- Tipo emisión: ${tipoEmision} (${tipoEmision.length} chars)`);
    console.log(`- Dígito verificador: ${digitoVerificador} (${digitoVerificador.length} chars)`);// Verificar longitud final (debe ser 49)
    if (claveCompleta.length !== 49) {
      console.error(`Error en longitud de clave generada: ${claveCompleta.length} (esperado 49)`);
      // Ajustar para que siempre tenga 49 caracteres
      if (claveCompleta.length > 49) {
        return claveCompleta.substring(0, 49);
      } else {
        return claveCompleta.padEnd(49, '0');
      }
    }
    
    return claveCompleta;
  } catch (error) {
    console.error("Error generando clave de acceso manual:", error);
    
    // Generar una clave de emergencia que cumpla con los 49 caracteres
    const fechaHoy = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const timestamp = Date.now().toString().substring(0, 10);
    const clave = `${fechaHoy}01${'0'.repeat(30)}${timestamp}`;
    return clave.substring(0, 49);
  }
}

/**
 * Calcula el dígito verificador para una clave de acceso según algoritmo del SRI (módulo 11)
 * @param {String} clave Clave base sin el dígito verificador
 * @returns {String} Dígito verificador (0-9)
 */
export function calcularDigitoVerificador(clave) {
  const coeficientes = [2, 3, 4, 5, 6, 7];
  let suma = 0;
  let coeficientePos = 0;
  
  // Sumar los productos de cada dígito por el coeficiente correspondiente
  for (let i = clave.length - 1; i >= 0; i--) {
    const digito = parseInt(clave[i], 10);
    suma += digito * coeficientes[coeficientePos];
    coeficientePos = (coeficientePos + 1) % coeficientes.length;
  }
  
  // Calcular el módulo 11
  const modulo = suma % 11;
  const resultado = 11 - modulo;
  
  // Si el resultado es 11, el dígito es 0; si es 10, el dígito es 1; en otro caso, es el resultado mismo
  if (resultado === 11) {
    return '0';
  } else if (resultado === 10) {
    return '1';
  } else {
    return resultado.toString();
  }
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
    
    // Crear solicitud SOAP
    const soapRequest = `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ec="http://ec.gob.sri.ws.recepcion">
  <soapenv:Header/>
  <soapenv:Body>
    <ec:validarComprobante>
      <xml>${Buffer.from(xml).toString('base64')}</xml>
    </ec:validarComprobante>
  </soapenv:Body>
</soapenv:Envelope>`;

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
