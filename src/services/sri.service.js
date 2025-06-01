import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import xml2js from 'xml2js';
import axios from 'axios';
import { getConnection } from '../database/connection.js';

/**
 * Clase para manejar toda la interacción con el SRI
 */
class SRIService {
  constructor() {
    this.XMLNS = {
      factura: 'http://www.w3.org/2000/09/xmldsig#',
      // Otros namespaces necesarios
    };
    
    this.WS_URLS = {
      pruebas: {
        recepcion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        autorizacion: 'https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
      },
      produccion: {
        recepcion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl',
        autorizacion: 'https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl'
      }
    };
  }

  /**
   * Genera el XML de la factura según el esquema XSD del SRI
   * @param {Object} facturaData - Datos de la factura
   * @returns {String} XML generado
   */
  async generarXML(facturaData) {
    try {
      const builder = new xml2js.Builder({
        rootName: 'factura',
        xmldec: { version: '1.0', encoding: 'UTF-8' },
        renderOpts: { pretty: true },
        xmlns: this.XMLNS
      });

      // Estructura según XSD del SRI
      const xmlObj = {
        infoTributaria: {
          ambiente: facturaData.ambiente,
          tipoEmision: '1',
          razonSocial: facturaData.emisor.razonSocial,
          nombreComercial: facturaData.emisor.nombreComercial,
          ruc: facturaData.emisor.ruc,
          claveAcceso: facturaData.claveAcceso,
          codDoc: '01', // Código para factura
          estab: facturaData.emisor.codigoEstablecimiento,
          ptoEmi: facturaData.puntoEmision,
          secuencial: facturaData.numeroSecuencial,
          dirMatriz: facturaData.emisor.direccion
        },
        infoFactura: {
          fechaEmision: facturaData.fechaEmision,
          dirEstablecimiento: facturaData.emisor.direccion,
          obligadoContabilidad: facturaData.emisor.obligadoContabilidad ? 'SI' : 'NO',
          tipoIdentificacionComprador: this.obtenerTipoIdentificacion(facturaData.cliente.cedula_ruc),
          razonSocialComprador: `${facturaData.cliente.nombre} ${facturaData.cliente.apellido}`,
          identificacionComprador: facturaData.cliente.cedula_ruc,
          totalSinImpuestos: this.calcularTotalSinImpuestos(facturaData.detalles),
          totalDescuento: '0.00',
          totalConImpuestos: this.calcularImpuestos(facturaData.detalles),
          propina: '0.00',
          importeTotal: this.calcularImporteTotal(facturaData.detalles),
          moneda: 'DOLAR'
        },
        detalles: {
          detalle: facturaData.detalles.map(d => ({
            codigoPrincipal: d.id_producto.toString(),
            descripcion: d.descripcion,
            cantidad: d.cantidad,
            precioUnitario: d.precio_unitario,
            descuento: '0.00',
            precioTotalSinImpuesto: d.subtotal,
            impuestos: {
              impuesto: {
                codigo: '2', // IVA
                codigoPorcentaje: this.obtenerCodigoPorcentajeIVA(d.iva),
                tarifa: (d.iva * 100).toString(),
                baseImponible: d.subtotal,
                valor: d.iva_valor
              }
            }
          }))
        },
        infoAdicional: {
          campoAdicional: [
            {
              _: facturaData.cliente.email,
              nombre: 'email'
            },
            {
              _: facturaData.cliente.telefono || 'N/A',
              nombre: 'telefono'
            }
          ]
        }
      };

      return builder.buildObject(xmlObj);
    } catch (error) {
      console.error('Error generando XML:', error);
      throw error;
    }
  }

  /**
   * Firma el XML usando el certificado digital
   * @param {String} xml - XML a firmar
   * @param {String} certificadoPath - Ruta al archivo .p12
   * @param {String} clave - Clave del certificado
   * @returns {String} XML firmado
   */
  async firmarXML(xml, certificadoPath, clave) {
    try {
      // Leer el certificado .p12
      const p12Buffer = fs.readFileSync(certificadoPath);
      const p12Asn1 = forge.asn1.fromDer(forge.util.decode64(p12Buffer.toString('base64')));
      const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, clave);

      // Obtener clave privada y certificado
      const privateKey = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
      const cert = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag][0].cert;

      // Implementar firma XAdES-BES
      // Aquí iría la implementación específica de la firma según especificaciones del SRI
      // Este es un placeholder - se necesita implementar según la ficha técnica del SRI

      return xmlFirmado; // XML con firma XAdES-BES
    } catch (error) {
      console.error('Error firmando XML:', error);
      throw error;
    }
  }

  /**
   * Envía el comprobante al SRI
   * @param {String} xmlFirmado - XML firmado a enviar
   * @param {Boolean} ambiente - true para producción, false para pruebas
   * @returns {Object} Respuesta del SRI
   */
  async enviarComprobante(xmlFirmado, ambiente) {
    try {
      const url = ambiente ? 
        this.WS_URLS.produccion.recepcion : 
        this.WS_URLS.pruebas.recepcion;

      // Implementar llamada SOAP al SRI
      const response = await axios.post(url, {
        // Configurar request SOAP según documentación del SRI
      });

      return response.data;
    } catch (error) {
      console.error('Error enviando comprobante:', error);
      throw error;
    }
  }

  /**
   * Autoriza el comprobante en el SRI
   * @param {String} claveAcceso - Clave de acceso del comprobante
   * @param {Boolean} ambiente - true para producción, false para pruebas
   * @returns {Object} Respuesta de autorización del SRI
   */
  async autorizarComprobante(claveAcceso, ambiente) {
    try {
      const url = ambiente ? 
        this.WS_URLS.produccion.autorizacion : 
        this.WS_URLS.pruebas.autorizacion;

      // Implementar llamada SOAP al SRI
      const response = await axios.post(url, {
        // Configurar request SOAP según documentación del SRI
      });

      return response.data;
    } catch (error) {
      console.error('Error autorizando comprobante:', error);
      throw error;
    }
  }

  /**
   * Genera el PDF de la factura
   * @param {Object} facturaData - Datos de la factura
   * @param {String} xmlAutorizado - XML autorizado por el SRI
   * @returns {Buffer} PDF generado
   */
  async generarPDF(facturaData, xmlAutorizado) {
    try {
      // Implementar generación de RIDE según formato del SRI
      // Se puede usar PDFKit o similar
      return pdfBuffer;
    } catch (error) {
      console.error('Error generando PDF:', error);
      throw error;
    }
  }

  // Métodos auxiliares
  obtenerTipoIdentificacion(identificacion) {
    if (identificacion.length === 13) return '04'; // RUC
    if (identificacion.length === 10) return '05'; // Cédula
    return '06'; // Pasaporte
  }

  obtenerCodigoPorcentajeIVA(iva) {
    if (iva === 0) return '0';
    if (iva === 0.12) return '2';
    if (iva === 0.14) return '3';
    return '2'; // 12% por defecto
  }

  calcularTotalSinImpuestos(detalles) {
    return detalles.reduce((sum, d) => sum + d.subtotal, 0).toFixed(2);
  }

  calcularImporteTotal(detalles) {
    return detalles.reduce((sum, d) => sum + d.total, 0).toFixed(2);
  }

  calcularImpuestos(detalles) {
    return {
      totalImpuesto: {
        codigo: '2',
        codigoPorcentaje: '2',
        baseImponible: this.calcularTotalSinImpuestos(detalles),
        valor: detalles.reduce((sum, d) => sum + d.iva_valor, 0).toFixed(2)
      }
    };
  }
}

export default new SRIService();
