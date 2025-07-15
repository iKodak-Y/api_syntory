/**
 * Generador XML EXACTO basado en el XML oficial del SRI
 * Usa el XML oficial como plantilla y solo cambia los valores necesarios
 */

/**
 * Genera XML usando exactamente la plantilla oficial del SRI
 */
export function generateFacturaXMLExacto(facturaData) {
  console.log('📋 === GENERANDO XML EXACTO COMO PLANTILLA OFICIAL === 📋');
  
  const {
    infoTributaria,
    infoFactura,
    detalles,
    infoAdicional
  } = facturaData;

  // Validar que tenemos todos los datos necesarios
  if (!infoTributaria || !infoFactura || !detalles || !Array.isArray(detalles) || detalles.length === 0) {
    throw new Error('Datos de factura incompletos para generar XML');
  }

  // Función para escapar XML de forma segura
  const escape = (str) => {
    if (!str) return '';
    return str.toString()
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

  // Obtener valores de impuestos - CORREGIDO
  const impuesto = infoFactura.totalConImpuestos?.[0] || {
    codigo: "2",
    codigoPorcentaje: "4", 
    baseImponible: "0.00",
    tarifa: "15.00",
    valor: "0.00"
  };
  const detalleImpuesto = detalles[0]?.impuestos?.[0] || {
    codigo: "2",
    codigoPorcentaje: "4",
    tarifa: "15.00", 
    baseImponible: "0.00",
    valor: "0.00"
  };
  const pago = infoFactura.pagos?.[0] || {
    formaPago: "01",
    total: "0.00",
    plazo: "0",
    unidadTiempo: "dias"
  };

  // Log para debug
  console.log('🔍 Validando estructura de impuestos:');
  console.log('- Impuesto total:', impuesto);
  console.log('- Impuesto detalle:', detalleImpuesto);
  console.log('- Pago:', pago);

  // Validar información adicional
  const infoAdicionalLimpia = Array.isArray(infoAdicional) ? infoAdicional : [];
  console.log('📝 Info adicional validada:', infoAdicionalLimpia);

  // XML EXACTO basado en la plantilla oficial del SRI V1.1.0
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura xmlns:ds="http://www.w3.org/2000/09/xmldsig#"
 xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" id="comprobante" version="1.1.0">
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
        <obligadoContabilidad>${infoFactura.obligadoContabilidad}</obligadoContabilidad>
        <tipoIdentificacionComprador>${infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>
        <razonSocialComprador>${escape(infoFactura.razonSocialComprador)}</razonSocialComprador>
        <identificacionComprador>${infoFactura.identificacionComprador}</identificacionComprador>${infoFactura.direccionComprador && infoFactura.direccionComprador.trim() ? `
        <direccionComprador>${escape(infoFactura.direccionComprador)}</direccionComprador>` : ''}
        <totalSinImpuestos>${infoFactura.totalSinImpuestos}</totalSinImpuestos>
        <totalDescuento>${infoFactura.totalDescuento}</totalDescuento>
        <totalConImpuestos>
            <totalImpuesto>
                <codigo>${impuesto.codigo || "2"}</codigo>
                <codigoPorcentaje>${impuesto.codigoPorcentaje || "4"}</codigoPorcentaje>
                <baseImponible>${impuesto.baseImponible || "0.00"}</baseImponible>
                <tarifa>${impuesto.tarifa || "15.00"}</tarifa>
                <valor>${impuesto.valor || "0.00"}</valor>
            </totalImpuesto>
        </totalConImpuestos>
        <propina>${infoFactura.propina}</propina>
        <importeTotal>${infoFactura.importeTotal}</importeTotal>
        <moneda>${infoFactura.moneda}</moneda>
        <pagos>
            <pago>
                <formaPago>${pago.formaPago || "01"}</formaPago>
                <total>${pago.total || "0.00"}</total>
                <plazo>${pago.plazo || "0"}</plazo>
                <unidadTiempo>${pago.unidadTiempo || "dias"}</unidadTiempo>
            </pago>
        </pagos>
    </infoFactura>
    <detalles>
        <detalle>
            <codigoPrincipal>${escape(detalles[0].codigoPrincipal)}</codigoPrincipal>
            <descripcion>${escape(detalles[0].descripcion)}</descripcion>
            <cantidad>${parseFloat(detalles[0].cantidad).toFixed(6)}</cantidad>
            <precioUnitario>${parseFloat(detalles[0].precioUnitario).toFixed(6)}</precioUnitario>
            <descuento>${detalles[0].descuento}</descuento>
            <precioTotalSinImpuesto>${detalles[0].precioTotalSinImpuesto}</precioTotalSinImpuesto>
            <impuestos>
                <impuesto>
                    <codigo>${detalleImpuesto.codigo || "2"}</codigo>
                    <codigoPorcentaje>${detalleImpuesto.codigoPorcentaje || "4"}</codigoPorcentaje>
                    <tarifa>${detalleImpuesto.tarifa || "15.00"}</tarifa>
                    <baseImponible>${detalleImpuesto.baseImponible || "0.00"}</baseImponible>
                    <valor>${detalleImpuesto.valor || "0.00"}</valor>
                </impuesto>
            </impuestos>
        </detalle>
    </detalles>
    <infoAdicional>
        ${infoAdicionalLimpia.map(info => 
          `<campoAdicional nombre="${escape(info.nombre || '')}">${escape(info.valor || '')}</campoAdicional>`
        ).join('\n        ')}
    </infoAdicional>
</factura>`;

  console.log('✅ XML exacto generado usando plantilla oficial');
  return xml;
}
