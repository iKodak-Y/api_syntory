/**
 * Generador XML oficial basado en el XML autorizado exitosamente del SRI
 * Estructura EXACTA del XML validado y autorizado por el SRI
 * Clave de acceso: 1006202501245064636500120021000000001267082936319
 */

/**
 * Genera XML exactamente como el XML autorizado oficial del SRI
 * Basado en factura real autorizada exitosamente (secuencial 000000126)
 */
export function generateFacturaXMLSRIOficial(facturaData) {
  console.log('📋 === GENERANDO XML OFICIAL SRI (ESTRUCTURA AUTORIZADA) === 📋');
  
  const {
    infoTributaria,
    infoFactura,
    detalles,
    infoAdicional
  } = facturaData;

  // Función para escapar XML de forma segura
  const escape = (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // Obtener valores para impuestos (estructura correcta según XML autorizado)
  const totalImpuesto = infoFactura.totalConImpuestos && infoFactura.totalConImpuestos.length > 0 
    ? infoFactura.totalConImpuestos[0] 
    : (infoFactura.totalConImpuestos?.totalImpuesto?.[0] || {});
    
  const detalleImpuesto = detalles && detalles.length > 0 && detalles[0].impuestos && detalles[0].impuestos.length > 0
    ? detalles[0].impuestos[0]
    : {};
    
  const pago = infoFactura.pagos && infoFactura.pagos.length > 0 
    ? infoFactura.pagos[0] 
    : (infoFactura.pagos?.pago?.[0] || {});

  // Validar datos críticos basados en XML autorizado real
  if (!totalImpuesto.codigo) {
    totalImpuesto.codigo = '2'; // IVA
    totalImpuesto.codigoPorcentaje = '4'; // 15%
    totalImpuesto.tarifa = '15.0';
  }

  if (!detalleImpuesto.codigo) {
    detalleImpuesto.codigo = '2'; // IVA
    detalleImpuesto.codigoPorcentaje = '4'; // 15%
    detalleImpuesto.tarifa = '15.0';
  }

  if (!pago.formaPago) {
    pago.formaPago = '01'; // Efectivo (según XML autorizado)
  }

  // Asegurar valores por defecto según XML autorizado
  const propina = infoFactura.propina || '0';
  const totalDescuento = infoFactura.totalDescuento || '0.00';
  const moneda = infoFactura.moneda || 'DOLAR';
  const obligadoContabilidad = infoFactura.obligadoContabilidad || 'NO';

  // XML EXACTO basado en estructura autorizada por SRI (secuencial 000000126)
  let xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura id="comprobante" version="1.1.0">
<infoTributaria>
<ambiente>${infoTributaria.ambiente}</ambiente>
<tipoEmision>${infoTributaria.tipoEmision}</tipoEmision>
<razonSocial>${escape(infoTributaria.razonSocial)}</razonSocial>
<nombreComercial>${escape(infoTributaria.nombreComercial)}</nombreComercial>
<ruc>${infoTributaria.ruc}</ruc>
<claveAcceso>${infoTributaria.claveAcceso}</claveAcceso>
<codDoc>${infoTributaria.codDoc}</codDoc>
<estab>${infoTributaria.estab}</estab>
<ptoEmi>${infoTributaria.ptoEmi}</ptoEmi>
<secuencial>${infoTributaria.secuencial}</secuencial>
<dirMatriz>${escape(infoTributaria.dirMatriz)}</dirMatriz>
</infoTributaria>
<infoFactura>
<fechaEmision>${infoFactura.fechaEmision}</fechaEmision>
<dirEstablecimiento>${escape(infoFactura.dirEstablecimiento)}</dirEstablecimiento>
<obligadoContabilidad>${obligadoContabilidad}</obligadoContabilidad>
<tipoIdentificacionComprador>${infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>
<razonSocialComprador>${escape(infoFactura.razonSocialComprador)}</razonSocialComprador>
<identificacionComprador>${infoFactura.identificacionComprador}</identificacionComprador>
<totalSinImpuestos>${infoFactura.totalSinImpuestos}</totalSinImpuestos>
<totalDescuento>${totalDescuento}</totalDescuento>
<totalConImpuestos>
<totalImpuesto>
<codigo>${totalImpuesto.codigo}</codigo>
<codigoPorcentaje>${totalImpuesto.codigoPorcentaje}</codigoPorcentaje>
<baseImponible>${totalImpuesto.baseImponible}</baseImponible>
<valor>${totalImpuesto.valor}</valor>
</totalImpuesto>
</totalConImpuestos>
<propina>${propina}</propina>
<importeTotal>${infoFactura.importeTotal}</importeTotal>
<moneda>${moneda}</moneda>
<pagos>
<pago>
<formaPago>${pago.formaPago}</formaPago>
<total>${pago.total}</total>
</pago>
</pagos>
</infoFactura>
<detalles>`;

  // Agregar detalles
  for (let i = 0; i < detalles.length; i++) {
    const detalle = detalles[i];
    const impuestoDetalle = detalle.impuestos && detalle.impuestos.length > 0 ? detalle.impuestos[0] : detalleImpuesto;
    
    xml += `
<detalle>
<codigoPrincipal>${escape(detalle.codigoPrincipal)}</codigoPrincipal>
<descripcion>${escape(detalle.descripcion)}</descripcion>
<cantidad>${parseFloat(detalle.cantidad).toFixed(1)}</cantidad>
<precioUnitario>${parseFloat(detalle.precioUnitario).toFixed(2)}</precioUnitario>
<descuento>${detalle.descuento}</descuento>
<precioTotalSinImpuesto>${detalle.precioTotalSinImpuesto}</precioTotalSinImpuesto>
<impuestos>
<impuesto>
<codigo>${impuestoDetalle.codigo}</codigo>
<codigoPorcentaje>${impuestoDetalle.codigoPorcentaje}</codigoPorcentaje>
<tarifa>${impuestoDetalle.tarifa}</tarifa>
<baseImponible>${impuestoDetalle.baseImponible}</baseImponible>
<valor>${impuestoDetalle.valor}</valor>
</impuesto>
</impuestos>
</detalle>`;
  }

  xml += `
</detalles>`;

  // Agregar información adicional si existe
  if (infoAdicional && infoAdicional.length > 0) {
    xml += `
<infoAdicional>`;
    
    for (const campo of infoAdicional) {
      const nombre = campo['@nombre'] || campo.nombre;
      const valor = campo['#text'] || campo.valor || campo.descripcion;
      
      if (nombre && valor) {
        xml += `
<campoAdicional nombre="${escape(nombre)}">${escape(valor)}</campoAdicional>`;
      }
    }
    
    xml += `
</infoAdicional>`;
  }

  xml += `
</factura>`;

  console.log('✅ XML oficial SRI generado usando estructura EXACTA de factura autorizada (126)');
  console.log('🔑 Basado en clave autorizada: 1006202501245064636500120021000000001267082936319');
  return xml;
}
