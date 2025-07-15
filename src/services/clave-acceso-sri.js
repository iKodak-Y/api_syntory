/**
 * Implementación CORREGIDA de generarClaveAcceso según especificaciones exactas del SRI Ecuador
 * Basada en el análisis de facturas válidas reales del SRI
 * 
 * FORMATO CLAVE DE ACCESO SRI (49 dígitos):
 * - fecha(DDMMAAAA): 8 dígitos (¡IMPORTANTE: Año completo, NO corto!)
 * - tipoComprobante(01): 2 dígitos  
 * - ruc: 13 dígitos
 * - ambiente(1-2): 1 dígito
 * - serie(estab+ptoEmi): 6 dígitos
 * - secuencial: 9 dígitos
 * - códigoNumerico: 8 dígitos
 * - tipoEmision(1): 1 dígito
 * - digitoVerificador: 1 dígito
 * TOTAL: 49 dígitos
 */

/**
 * Genera la clave de acceso según especificaciones SRI
 * @param {Object} data Datos necesarios para generar la clave
 * @returns {String} Clave de acceso de 49 dígitos
 */
export function generarClaveAcceso(data) {
  try {
    console.log(`🔑 === GENERANDO CLAVE DE ACCESO SRI === 🔑`);
    console.log('📋 Datos recibidos:', JSON.stringify(data, null, 2));
    
    // 1. PROCESAR Y NORMALIZAR LA FECHA (formato DDMMAAAA - 8 dígitos)
    let fechaDDMMAAAA = "";
    
    // Siempre procesar desde fechaEmision para asegurar coherencia
    console.log(`📅 Procesando fecha desde fechaEmision: ${data.fechaEmision}`);
    
    let fechaObj;
    
    if (typeof data.fechaEmision === 'string') {
      console.log(`📅 DEBUG: fechaEmision es string, longitud: ${data.fechaEmision.length}`);
      
      if (data.fechaEmision.length === 8 && /^\d{8}$/.test(data.fechaEmision)) {
        // Ya está en formato DDMMAAAA
        fechaDDMMAAAA = data.fechaEmision;
        console.log(`📅 Fecha ya en formato DDMMAAAA: ${fechaDDMMAAAA}`);
      } else if (data.fechaEmision.includes('/')) {
        console.log(`📅 DEBUG: Detectado formato DD/MM/YYYY`);
        // Formato DD/MM/YYYY
        const [dia, mes, anio] = data.fechaEmision.split('/');
        fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
      } else if (data.fechaEmision.match(/^\d{4}-\d{2}-\d{2}$/)) {
        console.log(`📅 DEBUG: Detectado formato ISO YYYY-MM-DD`);
        // Formato YYYY-MM-DD - Manejar con cuidado para evitar problemas de timezone
        const [anio, mes, dia] = data.fechaEmision.split('-');
        fechaObj = new Date(parseInt(anio), parseInt(mes) - 1, parseInt(dia));
      } else {
        // Otros formatos (como "Sat Jun 21 00:00:00 GMT-05:00 2025")
        console.log(`📅 DEBUG: Intentando parsear formato no estándar: "${data.fechaEmision}"`);
        
        // Intentar parsear directamente
        fechaObj = new Date(data.fechaEmision);
        console.log(`📅 DEBUG: Parseo directo resultado: ${fechaObj}, válido: ${!isNaN(fechaObj.getTime())}`);
        
        // Si falla el parseo directo, intentar extraer manualmente la fecha
        if (isNaN(fechaObj.getTime())) {
          console.log(`📅 DEBUG: Parseo directo falló, intentando extracción manual`);
          
          // Buscar patrones específicos en el string
          const meses = {
            'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
            'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
          };
          
          // Patrón: "Sat Jun 21 00:00:00 GMT-05:00 2025"
          const match = data.fechaEmision.match(/(\w{3})\s+(\w{3})\s+(\d{1,2})\s+[\d:]+\s+[A-Z\-\+\d:]+\s+(\d{4})/);
          console.log(`📅 DEBUG: Match encontrado: ${match ? JSON.stringify(match) : 'null'}`);
          
          if (match) {
            const [, , mesStr, diaStr, anioStr] = match;
            const mes = meses[mesStr];
            console.log(`📅 DEBUG: Extrayendo - mes: ${mesStr} -> ${mes}, día: ${diaStr}, año: ${anioStr}`);
            
            if (mes) {
              const dia = parseInt(diaStr);
              const anio = parseInt(anioStr);
              fechaObj = new Date(anio, parseInt(mes) - 1, dia);
              console.log(`📅 DEBUG: Fecha construida manualmente: ${fechaObj}, válida: ${!isNaN(fechaObj.getTime())}`);
            }
          }
        }
      }
    } else if (data.fechaEmision instanceof Date) {
      fechaObj = data.fechaEmision;
    } else {
      fechaObj = new Date(); // Fecha actual como respaldo
    }
    
    // Procesar fecha si no tenemos formato DDMMAAAA válido
    if (!fechaDDMMAAAA && fechaObj) {
      // Validar fecha
      if (isNaN(fechaObj.getTime())) {
        console.warn('⚠️ Fecha inválida, usando fecha actual');
        fechaObj = new Date();
      }
      
      // Generar formato DDMMAAAA (8 dígitos con año completo)
      const dia = fechaObj.getDate().toString().padStart(2, '0');
      const mes = (fechaObj.getMonth() + 1).toString().padStart(2, '0');
      const anioCompleto = fechaObj.getFullYear().toString(); // 4 dígitos
      fechaDDMMAAAA = `${dia}${mes}${anioCompleto}`;
    }
    
    console.log(`📅 Fecha para clave (DDMMAAAA): ${fechaDDMMAAAA}`);
    
    // 2. VALIDACIONES OBLIGATORIAS
    if (!data.ruc) throw new Error("RUC es obligatorio");
    if (!data.secuencial) throw new Error("Secuencial es obligatorio");
    
    // 3. CONSTRUIR COMPONENTES SEGÚN ESPECIFICACIONES SRI
    
    // 3.1 Fecha (8 dígitos DDMMAAAA)
    const fechaClave = fechaDDMMAAAA;
    
    // 3.2 Tipo de comprobante (2 dígitos) - 01 para factura
    const tipoComprobante = '01';
    
    // 3.3 RUC (13 dígitos exactos)
    let ruc = data.ruc.toString().replace(/[^0-9]/g, ''); // Solo números
    if (ruc.length < 13) {
      ruc = ruc.padStart(13, '0');
    } else if (ruc.length > 13) {
      ruc = ruc.substring(0, 13);
    }
    
    // 3.4 Ambiente (1 dígito) - 1=pruebas, 2=producción
    const ambiente = data.ambiente === 'produccion' || data.ambiente === '2' ? '2' : '1';
    
    // 3.5 Serie = Establecimiento + Punto Emisión (6 dígitos)
    const establecimiento = (data.codigoEstablecimiento || '001').toString().padStart(3, '0');
    const puntoEmision = (data.puntoEmision || '001').toString().padStart(3, '0');
    const serie = establecimiento + puntoEmision;
    
    // 3.6 Secuencial (9 dígitos)
    let secuencial = data.secuencial.toString().replace(/[^0-9]/g, '');
    secuencial = parseInt(secuencial).toString().padStart(9, '0');
    
    // 3.7 Código numérico (8 dígitos) - Número aleatorio o fijo
    const codigoNumerico = generateCodigoNumerico();
    
    // 3.8 Tipo emisión (1 dígito) - 1=Normal
    const tipoEmision = '1';
    
    // 4. CONSTRUIR CLAVE BASE (48 dígitos)
    const claveBase = fechaClave + tipoComprobante + ruc + ambiente + serie + secuencial + codigoNumerico + tipoEmision;
    
    // 5. VERIFICAR LONGITUD EXACTA (debe ser 48 dígitos)
    if (claveBase.length !== 48) {
      console.error(`❌ ERROR: Longitud de clave base incorrecta: ${claveBase.length} (esperado: 48)`);
      console.log(`🔍 Análisis de componentes:
        - Fecha (DDMMAAAA): "${fechaClave}" (${fechaClave.length} dígitos)
        - Tipo Comprobante: "${tipoComprobante}" (${tipoComprobante.length} dígitos)  
        - RUC: "${ruc}" (${ruc.length} dígitos)
        - Ambiente: "${ambiente}" (${ambiente.length} dígitos)
        - Serie: "${serie}" (${serie.length} dígitos)
        - Secuencial: "${secuencial}" (${secuencial.length} dígitos)
        - Código Numérico: "${codigoNumerico}" (${codigoNumerico.length} dígitos)
        - Tipo Emisión: "${tipoEmision}" (${tipoEmision.length} dígitos)
        - TOTAL: ${claveBase.length} dígitos`);
      
      throw new Error(`Clave base tiene ${claveBase.length} dígitos, se esperan exactamente 48`);
    }
    
    // 6. CALCULAR DÍGITO VERIFICADOR MÓDULO 11
    const digitoVerificador = calcularDigitoVerificador(claveBase);
    
    // 7. CONSTRUIR CLAVE COMPLETA (49 dígitos)
    const claveCompleta = claveBase + digitoVerificador;
    
    // 8. VALIDACIÓN FINAL
    if (claveCompleta.length !== 49) {
      throw new Error(`Clave de acceso final tiene ${claveCompleta.length} dígitos, se esperan exactamente 49`);
    }
    
    // 9. LOGGING Y RETORNO
    console.log(`✅ CLAVE DE ACCESO GENERADA EXITOSAMENTE`);
    console.log(`🔑 Clave completa: ${claveCompleta}`);
    console.log(`📊 Desglose:
      - Fecha: ${claveCompleta.substring(0, 8)} (DDMMAAAA)
      - Tipo: ${claveCompleta.substring(8, 10)} (01=Factura)
      - RUC: ${claveCompleta.substring(10, 23)}
      - Ambiente: ${claveCompleta.substring(23, 24)} (1=Pruebas, 2=Producción)
      - Serie: ${claveCompleta.substring(24, 30)} (Estab+PtoEmi)
      - Secuencial: ${claveCompleta.substring(30, 39)}
      - Código: ${claveCompleta.substring(39, 47)}
      - Emisión: ${claveCompleta.substring(47, 48)} (1=Normal)
      - Verificador: ${claveCompleta.substring(48, 49)}`);
    console.log(`🔑 === FIN GENERACIÓN CLAVE DE ACCESO === 🔑`);
    
    return claveCompleta;
    
  } catch (error) {
    console.error(`❌ ERROR GENERANDO CLAVE DE ACCESO: ${error.message}`);
    throw new Error(`Error al generar clave de acceso SRI: ${error.message}`);
  }
}

/**
 * Genera un código numérico de 8 dígitos basado en timestamp y random
 * @returns {String} Código numérico de 8 dígitos
 */
function generateCodigoNumerico() {
  // Combinar timestamp y número aleatorio para mayor unicidad
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  
  // Tomar los últimos 4 dígitos del timestamp y 4 del random
  const timestampPart = timestamp.slice(-4);
  const randomPart = random.substring(0, 4);
  
  return timestampPart + randomPart;
}

/**
 * Calcula el dígito verificador usando el algoritmo módulo 11 del SRI
 * @param {String} clave - Clave base de 48 dígitos
 * @returns {String} Dígito verificador (1 dígito)
 */
export function calcularDigitoVerificador(clave) {
  try {
    // Coeficientes según especificación SRI
    const coeficientes = [2, 3, 4, 5, 6, 7];
    let suma = 0;
    let coeficienteIndex = 0;
    
    // Multiplicar cada dígito por su coeficiente correspondiente
    for (let i = 0; i < clave.length; i++) {
      const digito = parseInt(clave[i], 10);
      const coeficiente = coeficientes[coeficienteIndex];
      suma += digito * coeficiente;
      
      // Rotar coeficientes
      coeficienteIndex = (coeficienteIndex + 1) % coeficientes.length;
    }
    
    // Calcular módulo 11
    const modulo = suma % 11;
    const resultado = 11 - modulo;
    
    // Aplicar reglas del SRI para el dígito verificador
    if (resultado === 11) return '0';
    if (resultado === 10) return '1';
    
    return resultado.toString();
    
  } catch (error) {
    console.error('Error calculando dígito verificador:', error);
    throw new Error(`Error en cálculo de dígito verificador: ${error.message}`);
  }
}
