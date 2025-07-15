/**
 * Generador XML SIN NAMESPA  // XML SIMPLE con namespace esencial ds (requerido por XSD)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<factura xmlns:ds="http://www.w3.org/2000/09/xmldsig#" id="comprobante" version="1.1.0">`; para pruebas extremas
 * XML ultra simple sin namespaces ni atributos extra
 */

/**
 * Genera XML sin namespaces para evitar problemas con el parser del SRI
 */
export function generateFacturaXMLSimple(facturaData) {
  console.log('📋 === GENERANDO XML SIMPLE SIN NAMESPACES === 📋');
  
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

  // Obtener valores de impuestos
  const impuesto = infoFactura.totalConImpuestos?.totalImpuesto?.[0] || {};
  const detalleImpuesto = detalles[0]?.impuestos?.[0] || {};
  const pago = infoFactura.pagos?.pago?.[0] || {};

  // XML SIMPLE sin namespaces
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
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
        <obligadoContabilidad>${infoFactura.obligadoContabilidad}</obligadoContabilidad>
        <tipoIdentificacionComprador>${infoFactura.tipoIdentificacionComprador}</tipoIdentificacionComprador>
        <razonSocialComprador>${escape(infoFactura.razonSocialComprador)}</razonSocialComprador>
        <identificacionComprador>${infoFactura.identificacionComprador}</identificacionComprador>${infoFactura.direccionComprador && infoFactura.direccionComprador.trim() ? `
        <direccionComprador>${escape(infoFactura.direccionComprador)}</direccionComprador>` : ''}
        <totalSinImpuestos>${infoFactura.totalSinImpuestos}</totalSinImpuestos>
        <totalDescuento>${infoFactura.totalDescuento}</totalDescuento>
        <totalConImpuestos>
            <totalImpuesto>
                <codigo>${impuesto.codigo}</codigo>
                <codigoPorcentaje>${impuesto.codigoPorcentaje}</codigoPorcentaje>
                <baseImponible>${impuesto.baseImponible}</baseImponible>
                <tarifa>${impuesto.tarifa}</tarifa>
                <valor>${impuesto.valor}</valor>
            </totalImpuesto>
        </totalConImpuestos>
        <propina>${infoFactura.propina}</propina>
        <importeTotal>${infoFactura.importeTotal}</importeTotal>
        <moneda>${infoFactura.moneda}</moneda>
        <pagos>
            <pago>
                <formaPago>${pago.formaPago}</formaPago>
                <total>${pago.total}</total>
                <plazo>${pago.plazo}</plazo>
                <unidadTiempo>${pago.unidadTiempo}</unidadTiempo>
            </pago>
        </pagos>
    </infoFactura>
    <detalles>
        <detalle>
            <codigoPrincipal>${escape(detalles[0].codigoPrincipal)}</codigoPrincipal>
            <descripcion>${escape(detalles[0].descripcion)}</descripcion>
            <cantidad>${parseFloat(detalles[0].cantidad).toFixed(2)}</cantidad>
            <precioUnitario>${parseFloat(detalles[0].precioUnitario).toFixed(2)}</precioUnitario>
            <descuento>${detalles[0].descuento}</descuento>
            <precioTotalSinImpuesto>${detalles[0].precioTotalSinImpuesto}</precioTotalSinImpuesto>
            <impuestos>
                <impuesto>
                    <codigo>${detalleImpuesto.codigo}</codigo>
                    <codigoPorcentaje>${detalleImpuesto.codigoPorcentaje}</codigoPorcentaje>
                    <tarifa>${detalleImpuesto.tarifa}</tarifa>
                    <baseImponible>${detalleImpuesto.baseImponible}</baseImponible>
                    <valor>${detalleImpuesto.valor}</valor>
                </impuesto>
            </impuestos>
        </detalle>
    </detalles>
    <infoAdicional>${infoAdicional.map(campo => `
        <campoAdicional nombre="${escape(campo['@nombre'])}">${escape(campo['#text'])}</campoAdicional>`).join('')}
    </infoAdicional>
</factura>`;

  console.log('✅ XML simple generado sin namespaces');
  return xml;
}
