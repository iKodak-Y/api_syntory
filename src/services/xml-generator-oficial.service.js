/**
 * Generador XML que sigue EXACTAMENTE el formato oficial del SRI v1.1.0
 * Basado en los archivos oficiales: XML y XSD Factura/factura_V1.1.0.xml
 */

/**
 * Genera XML siguiendo exactamente la estructura oficial del SRI
 */
export function generateFacturaXMLOficial(facturaData) {
  console.log('🏛️ === GENERANDO XML CON FORMATO OFICIAL SRI === 🏛️');
  
  const {
    infoTributaria,
    infoFactura,
    detalles,
    infoAdicional
  } = facturaData;

  // Validar datos requeridos
  if (!infoTributaria || !infoFactura || !detalles) {
    throw new Error('Datos incompletos para generar XML');
  }

  // Formatear números exactamente como en el XML oficial
  const formatNumberOfficial = (num) => {
    if (!num && num !== 0) return '0.00';
    const numStr = num.toString();
    if (numStr.includes('.')) {
      // Ya tiene decimales
      const parts = numStr.split('.');
      return parts[0] + '.' + (parts[1] || '00').padEnd(2, '0').substring(0, 2);
    } else {
      // Sin decimales
      return numStr + '.00';
    }
  };

  const formatCantidad = (num) => {
    if (!num && num !== 0) return '1.000000';
    const numStr = num.toString();
    if (numStr.includes('.')) {
      const parts = numStr.split('.');
      return parts[0] + '.' + (parts[1] || '000000').padEnd(6, '0').substring(0, 6);
    } else {
      return numStr + '.000000';
    }
  };

  // Generar XML siguiendo EXACTAMENTE la estructura oficial
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="comprobante" version="1.1.0">
    <infoTributaria>
        <ambiente>${infoTributaria.ambiente}</ambiente>
        <tipoEmision>${infoTributaria.tipoEmision}</tipoEmision>
        <razonSocial>${escapeXMLOfficial(infoTributaria.razonSocial)}</razonSocial>
        <nombreComercial>${escapeXMLOfficial(infoTributaria.nombreComercial)}</nombreComercial>
        <ruc>${infoTributaria.ruc}</ruc>
        <claveAcceso>${infoTributaria.claveAcceso}</claveAcceso>
        <codDoc>${infoTributaria.codDoc}</codDoc>
        <estab>${infoTributaria.estab}</estab>
        <ptoEmi>${infoTributaria.ptoEmi}</ptoEmi>
        <secuencial>${infoTributaria.secuencial}</secuencial>
        <dirMatriz>${escapeXMLOfficial(infoTributaria.dirMatriz)}</dirMatriz>
    </infoTributaria>
    <infoFactura>
        <fechaEmision>${infoFactura.fechaEmision}</fechaEmision>
        <dirEstablecimiento>${escapeXMLOfficial(infoFactura.dirEstablecimiento)}</dirEstablecimiento>
        <obligadoContabilidad>${infoFactura.obligadoContabilidad}</obligadoContabilidad>
        <tipoIdentificacionComprador>${infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>
        <razonSocialComprador>${escapeXMLOfficial(infoFactura.razonSocialComprador)}</razonSocialComprador>
        <identificacionComprador>${infoFactura.identificacionComprador}</identificacionComprador>
        <direccionComprador>${escapeXMLOfficial(infoFactura.direccionComprador || '')}</direccionComprador>
        <totalSinImpuestos>${formatNumberOfficial(infoFactura.totalSinImpuestos)}</totalSinImpuestos>
        <totalDescuento>${formatNumberOfficial(infoFactura.totalDescuento)}</totalDescuento>
        ${generateTotalConImpuestosOfficial(infoFactura.totalConImpuestos, formatNumberOfficial)}
        <propina>${formatNumberOfficial(infoFactura.propina)}</propina>
        <importeTotal>${formatNumberOfficial(infoFactura.importeTotal)}</importeTotal>
        <moneda>${infoFactura.moneda}</moneda>
        ${generatePagosOfficial(infoFactura.pagos, formatNumberOfficial)}
    </infoFactura>
    <detalles>
        ${generateDetallesOfficial(detalles, formatCantidad, formatNumberOfficial)}
    </detalles>
    ${generateInfoAdicionalOfficial(infoAdicional)}
</factura>`;

  console.log('✅ XML oficial generado correctamente');
  return xml;
}

/**
 * Genera totalConImpuestos siguiendo formato oficial
 */
function generateTotalConImpuestosOfficial(totalConImpuestos, formatNumber) {
  if (!totalConImpuestos) {
    return '<totalConImpuestos></totalConImpuestos>';
  }

  let impuestos = [];
  if (Array.isArray(totalConImpuestos)) {
    impuestos = totalConImpuestos;
  } else if (totalConImpuestos.totalImpuesto && Array.isArray(totalConImpuestos.totalImpuesto)) {
    impuestos = totalConImpuestos.totalImpuesto;
  }

  if (impuestos.length === 0) {
    return '<totalConImpuestos></totalConImpuestos>';
  }

  let xml = '<totalConImpuestos>';
  
  impuestos.forEach(impuesto => {
    xml += `
            <totalImpuesto>
                <codigo>${impuesto.codigo}</codigo>
                <codigoPorcentaje>${impuesto.codigoPorcentaje}</codigoPorcentaje>
                <baseImponible>${formatNumber(impuesto.baseImponible)}</baseImponible>
                <tarifa>${formatNumber(impuesto.tarifa || '15.00')}</tarifa>
                <valor>${formatNumber(impuesto.valor)}</valor>
            </totalImpuesto>`;
  });
  
  xml += `
        </totalConImpuestos>`;
  return xml;
}

/**
 * Genera pagos siguiendo formato oficial
 */
function generatePagosOfficial(pagos, formatNumber) {
  if (!pagos) {
    return '';
  }

  let pagosList = [];
  if (Array.isArray(pagos)) {
    pagosList = pagos;
  } else if (pagos.pago && Array.isArray(pagos.pago)) {
    pagosList = pagos.pago;
  }

  if (pagosList.length === 0) {
    return '';
  }

  let xml = '<pagos>';
  
  pagosList.forEach(pago => {
    xml += `
            <pago>
                <formaPago>${pago.formaPago}</formaPago>
                <total>${formatNumber(pago.total)}</total>
                <plazo>${formatNumber(pago.plazo || '0.00')}</plazo>
                <unidadTiempo>${pago.unidadTiempo || 'dias'}</unidadTiempo>
            </pago>`;
  });
  
  xml += `
        </pagos>`;
  return xml;
}

/**
 * Genera detalles siguiendo formato oficial
 */
function generateDetallesOfficial(detalles, formatCantidad, formatNumber) {
  if (!detalles || detalles.length === 0) {
    return '';
  }

  let xml = '';
  
  detalles.forEach(detalle => {
    xml += `
        <detalle>
            <codigoPrincipal>${escapeXMLOfficial(detalle.codigoPrincipal || '')}</codigoPrincipal>
            <descripcion>${escapeXMLOfficial(detalle.descripcion)}</descripcion>
            <cantidad>${formatCantidad(detalle.cantidad)}</cantidad>
            <precioUnitario>${formatCantidad(detalle.precioUnitario)}</precioUnitario>
            <descuento>${formatNumber(detalle.descuento)}</descuento>
            <precioTotalSinImpuesto>${formatNumber(detalle.precioTotalSinImpuesto)}</precioTotalSinImpuesto>
            <impuestos>
                ${generateImpuestosDetalleOfficial(detalle.impuestos, formatNumber)}
            </impuestos>
        </detalle>`;
  });
  
  return xml;
}

/**
 * Genera impuestos de detalle siguiendo formato oficial
 */
function generateImpuestosDetalleOfficial(impuestos, formatNumber) {
  if (!impuestos || impuestos.length === 0) {
    return '';
  }

  let xml = '';
  
  impuestos.forEach(impuesto => {
    xml += `
                <impuesto>
                    <codigo>${impuesto.codigo}</codigo>
                    <codigoPorcentaje>${impuesto.codigoPorcentaje}</codigoPorcentaje>
                    <tarifa>${formatNumber(impuesto.tarifa)}</tarifa>
                    <baseImponible>${formatNumber(impuesto.baseImponible)}</baseImponible>
                    <valor>${formatNumber(impuesto.valor)}</valor>
                </impuesto>`;
  });
  
  return xml;
}

/**
 * Genera información adicional siguiendo formato oficial
 */
function generateInfoAdicionalOfficial(infoAdicional) {
  if (!infoAdicional || infoAdicional.length === 0) {
    return '';
  }

  let xml = `
    <infoAdicional>`;
  
  infoAdicional.forEach(info => {
    const nombre = info['@nombre'] || info.nombre;
    const valor = info['#text'] || info.valor || info.value;
    xml += `
        <campoAdicional nombre="${escapeXMLOfficial(nombre)}">${escapeXMLOfficial(valor)}</campoAdicional>`;
  });
  
  xml += `
    </infoAdicional>`;
  return xml;
}

/**
 * Escapa caracteres XML de forma oficial
 */
function escapeXMLOfficial(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
