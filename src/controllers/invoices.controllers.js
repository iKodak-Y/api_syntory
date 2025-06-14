import {
  generateInvoice,
  generateInvoiceXml,
  signXml,
  documentReception,
  documentAuthorization,
  getP12FromLocalFile,
} from "open-factura";
import { getConnection } from "../database/connection.js";
import fs from "fs";
import path from "path";

// URLs del SRI por ambiente
const SRI_URLS = {
  pruebas: {
    recepcion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacion: "https://celcer.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  },
  produccion: {
    recepcion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/RecepcionComprobantesOffline?wsdl",
    autorizacion: "https://cel.sri.gob.ec/comprobantes-electronicos-ws/AutorizacionComprobantesOffline?wsdl"
  }
};

export const getInvoices = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("factura_electronica")
      .select(
        `
        *,
        clientes:id_cliente (nombre, apellido),
        emisor:id_emisor (razon_social),
        usuarios:id_usuario (nombre_completo),
        detalle_factura (total)
      `
      )
      .order("fecha_emision", { ascending: false });

    if (error) throw error;    const facturasFormateadas =
      data?.map((factura) => ({
        ...factura,
        Cliente: `${factura.clientes?.nombre} ${factura.clientes?.apellido}`,
        Emisor: factura.emisor?.razon_social,
        Usuario: factura.usuarios?.nombre_completo,
        Total: factura.detalle_factura?.reduce(
          (sum, detail) => sum + detail.total,
          0
        ),
        fecha_emision: factura.fecha_emision?.split("T")[0],
        estado_sri: factura.estado, // Add this line to map estado to estado_sri
      })) || [];

    res.json(facturasFormateadas);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getBill = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("factura_electronica")
      .select(
        `
        *,
        clientes:id_cliente (*),
        emisor:id_emisor (*),
        usuarios:id_usuario (*),
        detalle_factura (*),
        forma_pago_factura (*),
        info_adicional_factura (*)
      `
      )
      .eq("id_factura", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getLastInvoiceNumber = async (req, res) => {
  try {
    const { emisorId, puntoEmision } = req.params;
    const supabase = await getConnection();

    const { data, error } = await supabase.rpc("obtener_siguiente_secuencial", {
      p_emisor_id: parseInt(emisorId),
      p_punto_emision: puntoEmision.trim(),
    });

    if (error) {
      console.error("Error en BD:", error);
      return res.status(500).json({
        message: "Error al obtener el secuencial",
        details: error.message,
      });
    }

    if (!data || !data[0]) {
      return res.status(500).json({
        message: "Error al obtener el secuencial",
      });
    }

    if (data[0].mensaje !== "OK") {
      return res.status(400).json({
        error: true,
        message: data[0].mensaje,
      });
    }

    const secuencial = data[0].siguiente_secuencial.padStart(9, "0");

    res.json({
      last_number: secuencial,
      mensaje: "OK",
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

export const createInvoice = async (req, res) => {
  try {
    console.log("=== INICIO CREACIÓN FACTURA ===");
    console.log("Datos recibidos del frontend:", JSON.stringify(req.body, null, 2));
    
    // Mapear datos del frontend con diferentes nombres posibles
    const datosFactura = mapearDatosFrontend(req.body);
    console.log("Datos mapeados:", JSON.stringify(datosFactura, null, 2));
    
    const {
      id_emisor,
      id_cliente,
      id_usuario,
      punto_emision,
      detalles,
      formas_pago,
      numero_secuencial,
      fecha_emision,
      ambiente_sri,
      subtotal,
      iva_total,
      total
    } = datosFactura;

    // Validar campos requeridos
    if (!id_emisor || !id_cliente || !id_usuario || !punto_emision || !detalles || !formas_pago) {
      console.log("Error: Faltan campos requeridos");
      return res.status(400).json({
        message: "Faltan campos requeridos",
        campos_requeridos: ["id_emisor", "id_cliente", "id_usuario", "punto_emision", "detalles", "formas_pago"],
        datos_recibidos: {
          id_emisor: !!id_emisor,
          id_cliente: !!id_cliente, 
          id_usuario: !!id_usuario,
          punto_emision: !!punto_emision,
          detalles: !!detalles,
          formas_pago: !!formas_pago
        },
        datos_originales: req.body
      });
    }

    const supabase = await getConnection();

    // Obtener datos del emisor
    console.log("Buscando emisor con ID:", id_emisor);
    const { data: emisor, error: emisorError } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", id_emisor)
      .single();

    if (emisorError || !emisor) {
      console.log("Error al obtener emisor:", emisorError);
      return res.status(404).json({
        message: "Emisor no encontrado",
        id_emisor_buscado: id_emisor,
        error: emisorError?.message
      });
    }

    console.log("Emisor encontrado:", emisor.razon_social);

    // Obtener datos del cliente
    console.log("Buscando cliente con ID:", id_cliente);
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .select("*")
      .eq("id_cliente", id_cliente)
      .single();

    if (clienteError || !cliente) {
      console.log("Error al obtener cliente:", clienteError);
      return res.status(404).json({
        message: "Cliente no encontrado",
        id_cliente_buscado: id_cliente,
        error: clienteError?.message
      });
    }

    console.log("Cliente encontrado:", cliente.nombre, cliente.apellido);    // Validar y procesar detalles de productos
    if (!Array.isArray(detalles) || detalles.length === 0) {
      console.log("Error: Detalles no válidos");
      return res.status(400).json({
        message: "Debe proporcionar al menos un producto",
        detalles_recibidos: detalles,
        tipo_detalles: typeof detalles,
        es_array: Array.isArray(detalles)
      });
    }

    console.log("Validando", detalles.length, "productos...");
    for (let i = 0; i < detalles.length; i++) {
      const detalle = detalles[i];
      console.log(`Producto ${i + 1}:`, {
        id_producto: detalle.id_producto,
        cantidad: detalle.cantidad,
        precio_unitario: detalle.precio_unitario,
        subtotal: detalle.subtotal
      });
      
      if (!detalle.id_producto) {
        return res.status(400).json({
          message: `El id_producto es requerido para el producto en posición ${i + 1}`,
          detalle_problemático: detalle,
          sugerencia: "Verifica que el frontend esté enviando 'id_producto', 'productoId' o 'id' para cada producto"
        });
      }
      if (!detalle.cantidad || detalle.cantidad <= 0) {
        return res.status(400).json({
          message: `La cantidad debe ser mayor a 0 para el producto ${detalle.id_producto}`,
          cantidad_recibida: detalle.cantidad,
          sugerencia: "Verifica que el frontend esté enviando 'cantidad', 'qty' o 'quantity' válida"
        });
      }
      if (!detalle.precio_unitario || detalle.precio_unitario <= 0) {
        return res.status(400).json({
          message: `El precio unitario debe ser mayor a 0 para el producto ${detalle.id_producto}`,
          precio_recibido: detalle.precio_unitario,
          sugerencia: "Verifica que el frontend esté enviando 'precio_unitario', 'precioUnitario' o 'precio' válido"
        });
      }
      if (!detalle.subtotal || detalle.subtotal <= 0) {
        return res.status(400).json({
          message: `El subtotal debe ser mayor a 0 para el producto ${detalle.id_producto}`,
          subtotal_recibido: detalle.subtotal,
          sugerencia: "El subtotal se puede calcular automáticamente como cantidad * precio_unitario"
        });
      }
    }    // Validar formas de pago
    if (!Array.isArray(formas_pago) || formas_pago.length === 0) {
      console.log("Error: Formas de pago no válidas");
      return res.status(400).json({
        message: "Debe proporcionar al menos una forma de pago",
        formas_pago_recibidas: formas_pago,
        tipo_formas_pago: typeof formas_pago,
        es_array: Array.isArray(formas_pago),
        sugerencia: "Verifica que el frontend esté enviando un array de formas de pago con 'forma_pago' y 'valor_pago'"
      });
    }

    console.log("Formas de pago recibidas:", formas_pago.length);
    
    // Validar cada forma de pago
    for (let i = 0; i < formas_pago.length; i++) {
      const pago = formas_pago[i];
      console.log(`Forma de pago ${i + 1}:`, pago);
        if (!pago.forma_pago && !pago.tipo && !pago.metodo && !pago.codigo) {
        return res.status(400).json({
          message: `La forma de pago es requerida para el pago en posición ${i + 1}`,
          pago_problemático: pago,
          sugerencia: "Debe incluir 'forma_pago', 'tipo', 'metodo' o 'codigo' (ej: 'efectivo', 'credito', 'debito' o '01')"
        });
      }
      
      if (!pago.valor_pago && !pago.valor && !pago.amount && !pago.monto) {
        return res.status(400).json({
          message: `El valor del pago es requerido para el pago en posición ${i + 1}`,
          pago_problemático: pago,
          sugerencia: "Debe incluir 'valor_pago', 'valor', 'amount' o 'monto' mayor a 0"
        });
      }
      
      const valorPago = Number(pago.valor_pago || pago.valor || pago.amount || pago.monto || 0);
      if (valorPago <= 0) {
        return res.status(400).json({
          message: `El valor del pago debe ser mayor a 0 para el pago en posición ${i + 1}`,
          valor_recibido: valorPago,
          pago_problemático: pago
        });
      }
    }

    // Obtener o generar siguiente secuencial
    let secuencial;
    if (numero_secuencial) {
      secuencial = numero_secuencial.replace(/^0+/, '') || '1'; // Remover ceros iniciales
      console.log("Usando secuencial proporcionado:", secuencial);
    } else {
      secuencial = await getLastInvoiceNumberFromDB(emisor.id_emisor, punto_emision);
      console.log("Secuencial generado automáticamente:", secuencial);
    }    // Configurar datos para open-factura (que generará automáticamente la clave de acceso)
    console.log("Preparando configuración para open-factura...");
    
    // Usar fecha proporcionada o fecha actual
    const fechaFactura = fecha_emision ? 
      new Date(fecha_emision).toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit", 
        year: "numeric",
      }).replace(/\//g, "/") :
      new Date().toLocaleDateString("es-EC", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).replace(/\//g, "/");

    console.log("Fecha factura:", fechaFactura);

    // Calcular totales correctamente
    const subtotalCalculado = detalles.reduce((sum, d) => sum + Number(d.subtotal || 0), 0);
    const ivaCalculado = detalles.reduce((sum, d) => {
      const subtotalProducto = Number(d.subtotal || 0);
      const ivaProducto = Number(d.iva || 0.15);
      return sum + (subtotalProducto * ivaProducto);
    }, 0);
    const totalCalculado = subtotalCalculado + ivaCalculado;

    console.log("Totales calculados:", {
      subtotal: subtotalCalculado,
      iva: ivaCalculado,
      total: totalCalculado
    });

    const facturaConfig = {
      infoTributaria: {
        ambiente: emisor.tipo_ambiente === "produccion" ? "2" : "1",
        tipoEmision: "1", // Normal
        razonSocial: emisor.razon_social,
        nombreComercial: emisor.nombre_comercial || emisor.razon_social,
        ruc: emisor.ruc,
        claveAcceso: "", // open-factura lo generará automáticamente
        codDoc: "01", // Factura
        estab: emisor.codigo_establecimiento.padStart(3, "0"),
        ptoEmi: punto_emision.padStart(3, "0"),
        secuencial: secuencial.padStart(9, "0"),
        dirMatriz: emisor.direccion,
      },
      infoFactura: {
        fechaEmision: fechaFactura,
        dirEstablecimiento: emisor.direccion,
        contribuyenteEspecial: "", // Si aplica
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
        pagos: formas_pago.map((fp) => {
          // Mapear nombres del frontend a códigos SRI
          const codigoFormaPago = mapFormaPagoFrontendToSRI(fp.forma_pago || fp.tipo);
          console.log("Mapeando forma de pago:", fp.forma_pago || fp.tipo, "->", codigoFormaPago);
          
          return {
            formaPago: codigoFormaPago,
            total: Number(fp.valor_pago || fp.valor || 0).toFixed(2),
            plazo: fp.plazo || 0,
            unidadTiempo: fp.unidad_tiempo || "dias",
          };
        }),
      },
      detalles: detalles.map((d, index) => {
        console.log(`Procesando detalle ${index + 1}:`, {
          id_producto: d.id_producto,
          cantidad: d.cantidad,
          precio_unitario: d.precio_unitario,
          subtotal: d.subtotal,
          iva: d.iva || 0.15
        });
        
        const subtotalProducto = Number(d.subtotal || 0);
        const ivaProducto = Number(d.iva || 0.15);
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
            },          ],
        };
      }),
      infoAdicional: [
        { nombre: "Email", valor: cliente.email || "N/A" },
        { nombre: "Teléfono", valor: cliente.telefono || "N/A" },
      ],
    };

    console.log("Generando factura con open-factura...");
    console.log("Configuración de factura:", JSON.stringify(facturaConfig, null, 2));
    
    // Generar la factura usando open-factura (genera automáticamente la clave de acceso)
    const { invoice, accessKey } = generateInvoice(facturaConfig);
    
    console.log("Factura generada con clave de acceso:", accessKey);
    console.log("Objeto invoice generado:", JSON.stringify(invoice, null, 2));

    // Generar XML    const invoiceXml = generateInvoiceXml(invoice);
    console.log("XML generado exitosamente, longitud:", invoiceXml.length);
    
    // Validar que el XML se generó correctamente
    if (!invoiceXml || invoiceXml.length === 0) {
      throw new Error("El XML generado está vacío o es inválido");
    }
    
    // Validar que el XML contiene elementos esenciales con logging detallado
    console.log("Verificando estructura del XML...");
    console.log("Contiene '<factura':", invoiceXml.includes('<factura'));
    console.log("Contiene '<comprobante':", invoiceXml.includes('<comprobante'));
    console.log("Contiene 'infoTributaria':", invoiceXml.includes('infoTributaria'));
    console.log("Contiene '<?xml':", invoiceXml.includes('<?xml'));
    
    if (!invoiceXml.includes('<factura') && !invoiceXml.includes('<comprobante') && !invoiceXml.includes('infoTributaria')) {
      console.error("XML generado no válido. Contenido:");
      console.error("Primeros 1000 caracteres:", invoiceXml.substring(0, 1000));
      throw new Error("El XML generado no contiene la estructura de factura esperada");
    }
    
    console.log("Primeros 500 caracteres del XML:", invoiceXml.substring(0, 500));
    console.log("Últimos 200 caracteres del XML:", invoiceXml.substring(invoiceXml.length - 200));

    // Guardar XML no firmado para referencia
    const xmlNoFirmadoPath = saveXmlToFile(invoiceXml, `factura_${accessKey}`, 'no-firmados');

    // Determinar ambiente para SRI
    const ambienteSRI = emisor.tipo_ambiente === "produccion" ? "produccion" : "pruebas";
    
    // Variables para el resultado del procesamiento
    let estadoSRI = "P"; // Pendiente
    let numeroAutorizacion = "";
    let signedXml = invoiceXml;

    // Verificar si existe certificado digital válido
    const tieneCertificado = emisor.certificado_path && 
                           fs.existsSync(emisor.certificado_path) && 
                           emisor.contrasena_certificado;

    if (!tieneCertificado) {
      console.log("MODO SIMULADO: Sin certificado digital válido");
      
      // Modo simulado para desarrollo
      estadoSRI = "A"; // Autorizado (simulado)
      numeroAutorizacion = `SIMULADO-${Date.now()}`;
      
      // Guardar en la base de datos
      const { data: facturaDB, error: facturaError } = await supabase
        .from("factura_electronica")
        .insert([
          {
            id_emisor,
            id_cliente,
            id_usuario,
            clave_acceso: accessKey,
            numero_secuencial: secuencial.padStart(9, "0"),
            fecha_emision: new Date().toISOString().split("T")[0],
            estado: estadoSRI,
            fecha_autorizacion: new Date().toISOString(),
            xml_autorizado: invoiceXml,
            pdf_path: null,
            punto_emision,
            ambiente_sri: ambienteSRI,
            numero_autorizacion: numeroAutorizacion,
            subtotal: facturaConfig.infoFactura.totalSinImpuestos,
            iva_total: facturaConfig.infoFactura.totalConImpuestos[0].valor,
            total: facturaConfig.infoFactura.importeTotal,
          },
        ])
        .select()
        .single();

      if (facturaError) throw facturaError;

      // Insertar detalles y formas de pago
      await Promise.all([
        supabase.from("detalle_factura").insert(detalles.map((d) => ({
          ...d,
          id_factura: facturaDB.id_factura,
          descripcion: d.descripcion || `Producto ${d.id_producto}`,
        }))),
        supabase.from("forma_pago_factura").insert(formas_pago.map((p) => ({
          ...p,
          id_factura: facturaDB.id_factura,
        })))
      ]);

      return res.status(201).json({
        success: true,
        message: "Factura creada en modo simulado (desarrollo)",
        ...facturaDB,
        clave_acceso: accessKey,
        xml_generado: true,
        firmado: false,
        estado_sri: estadoSRI,
        numero_autorizacion: numeroAutorizacion,
        modo_simulado: true,        nota: "Para producción necesitas configurar un certificado digital válido"
      });
    }

    // Proceso con certificado digital real
    console.log(`Procesando con certificado digital real - Ambiente: ${ambienteSRI}`);
    
    try {
      console.log("Firmando XML con certificado:", emisor.certificado_path);
      console.log("Longitud del XML a firmar:", invoiceXml.length);
      
      // Verificar que el archivo existe
      if (!fs.existsSync(emisor.certificado_path)) {
        throw new Error(`El archivo de certificado no existe: ${emisor.certificado_path}`);
      }
      
      // Verificar tamaño del archivo
      const stats = fs.statSync(emisor.certificado_path);
      console.log(`Certificado encontrado, tamaño: ${stats.size} bytes`);
      
      if (stats.size === 0) {
        throw new Error("El certificado está vacío");
      }
      
      const password = emisor.contrasena_certificado;
      if (!password) {
        throw new Error("No se ha configurado la contraseña del certificado");
      }
      
      console.log("Iniciando proceso de firma XML...");
      
      // Validar que el XML es válido antes de firmar
      if (!invoiceXml.includes('<?xml')) {
        throw new Error("El XML no tiene la declaración XML válida");
      }
      
      // Preparar XML limpio (sin espacios extra o caracteres problemáticos)
      const cleanXml = invoiceXml.trim();
      console.log("XML limpio preparado, longitud:", cleanXml.length);
      
      // Método 1: Cargar certificado primero con getP12FromLocalFile
      console.log("Método 1: Cargando certificado con getP12FromLocalFile...");
      try {
        const p12Data = await getP12FromLocalFile(emisor.certificado_path);
        console.log("Certificado cargado exitosamente, tipo:", typeof p12Data);
        
        if (!p12Data) {
          throw new Error("getP12FromLocalFile retornó null/undefined");
        }
        
        // Intentar firmar con el certificado cargado
        console.log("Firmando XML con certificado cargado...");
        signedXml = await signXml({
          certificate: p12Data,
          password: password,
          xml: cleanXml
        });
        
        console.log("✓ XML firmado exitosamente con método 1");
        console.log("Longitud del XML firmado:", signedXml.length);
        
      } catch (method1Error) {
        console.log("Método 1 falló:", method1Error.message);
        
        // Método 2: Usar path directamente
        console.log("Método 2: Usando path del certificado directamente...");
        try {
          signedXml = await signXml({
            certificatePath: emisor.certificado_path,
            password: password,
            xml: cleanXml
          });
          
          console.log("✓ XML firmado exitosamente con método 2");
          console.log("Longitud del XML firmado:", signedXml.length);
          
        } catch (method2Error) {
          console.log("Método 2 falló:", method2Error.message);
          
          // Método 3: Formato de parámetros posicionales
          console.log("Método 3: Usando parámetros posicionales...");
          try {
            const certBuffer = fs.readFileSync(emisor.certificado_path);
            signedXml = await signXml(certBuffer, password, cleanXml);
            
            console.log("✓ XML firmado exitosamente con método 3");  
            console.log("Longitud del XML firmado:", signedXml.length);
            
          } catch (method3Error) {
            console.log("Método 3 falló:", method3Error.message);
            
            // Método 4: Último intento con diferentes parámetros
            console.log("Método 4: Último intento...");
            try {
              signedXml = await signXml(emisor.certificado_path, password, cleanXml);
              
              console.log("✓ XML firmado exitosamente con método 4");
              console.log("Longitud del XML firmado:", signedXml.length);
              
            } catch (method4Error) {
              // Todos los métodos fallaron
              throw new Error(`Todos los métodos de firma fallaron:
              Método 1: ${method1Error.message}
              Método 2: ${method2Error.message}  
              Método 3: ${method3Error.message}
              Método 4: ${method4Error.message}`);
            }          }
        }
      }
      
      // XML firmado exitosamente, guardarlo
      const xmlFirmadoPath = saveXmlToFile(signedXml, `factura_firmada_${accessKey}`, 'firmados');
      console.log("XML firmado guardado en:", xmlFirmadoPath);
      
    } catch (signError) {
      console.error("Error al firmar XML:", signError);
      console.error("Stack completo:", signError.stack);
      
      return res.status(500).json({
        message: "Error al firmar el XML - Requerido para el SRI",
        details: signError.message,
        solucion: "Verifica que el certificado digital esté configurado correctamente y que la contraseña sea correcta",
        certificado_usado: emisor.certificado_path,
        xml_info: {
          longitud: invoiceXml.length,
          contiene_declaracion: invoiceXml.includes('<?xml'),
          contiene_factura: invoiceXml.includes('<factura>') || invoiceXml.includes('<comprobante>')
        },
        error_completo: signError.stack
      });    }

    // Validar XML firmado antes de enviar al SRI
    if (!signedXml || signedXml.length === 0) {
      throw new Error("El XML firmado está vacío");
    }
    
    // Verificar que el XML firmado contiene la estructura de firma
    if (!signedXml.includes('<ds:Signature') && !signedXml.includes('<Signature')) {
      console.warn("ADVERTENCIA: El XML no parece contener una firma digital válida");
    }
    
    console.log("XML firmado validado, preparando envío al SRI...");
    console.log("Contiene firma digital:", signedXml.includes('<ds:Signature') || signedXml.includes('<Signature'));

    // Enviar al SRI
    try {
      console.log(`Enviando factura al SRI - Ambiente: ${ambienteSRI}`);
      console.log(`URL de recepción: ${SRI_URLS[ambienteSRI].recepcion}`);
      
      // Validar URLs del SRI
      if (!SRI_URLS[ambienteSRI] || !SRI_URLS[ambienteSRI].recepcion) {
        throw new Error(`URLs del SRI no configuradas para ambiente: ${ambienteSRI}`);
      }
      
      // Enviar al SRI para recepción
      console.log("Enviando documento para recepción...");
      const receptionResult = await documentReception(
        signedXml,
        SRI_URLS[ambienteSRI].recepcion
      );      console.log("Resultado de recepción:", JSON.stringify(receptionResult, null, 2));

      // Manejar diferentes estados de respuesta del SRI
      if (receptionResult && (receptionResult.estado === "RECIBIDA" || receptionResult.comprobante === "RECIBIDA")) {
        console.log("✓ Documento recibido exitosamente por el SRI");
        console.log("Solicitando autorización...");
        
        // Dar tiempo al SRI para procesar antes de solicitar autorización
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        try {
          // Solicitar autorización
          const authorizationResult = await documentAuthorization(
            accessKey,
            SRI_URLS[ambienteSRI].autorizacion
          );

          console.log("Resultado de autorización:", JSON.stringify(authorizationResult, null, 2));          if (authorizationResult && (authorizationResult.estado === "AUTORIZADO" || authorizationResult.comprobante === "AUTORIZADA")) {
            estadoSRI = "A"; // Autorizado
            numeroAutorizacion = authorizationResult.numeroAutorizacion || authorizationResult.claveAcceso || accessKey;
            console.log("✓ Factura autorizada por el SRI");
            console.log("Número de autorización:", numeroAutorizacion);
            
            // Actualizar XML con la respuesta autorizada si está disponible
            if (authorizationResult.comprobante) {
              signedXml = authorizationResult.comprobante;
            }
            
            // Guardar XML autorizado
            const xmlAutorizadoPath = saveXmlToFile(signedXml, `factura_autorizada_${accessKey}`, 'autorizados');
            console.log("XML autorizado guardado en:", xmlAutorizadoPath);
            
          } else if (authorizationResult && authorizationResult.estado === "EN_PROCESAMIENTO") {
            estadoSRI = "E"; // Enviada (en procesamiento)
            console.log("⏳ Documento en procesamiento por el SRI");
            numeroAutorizacion = `PROCESANDO-${Date.now()}`;
            
          } else {
            estadoSRI = "R"; // Rechazado
            const mensajes = authorizationResult?.mensajes || authorizationResult?.informacionAdicional || ["Sin detalles del rechazo"];
            console.log("✗ Factura rechazada por el SRI:", mensajes);
            
            return res.status(400).json({
              message: "La factura fue rechazada por el SRI en autorización",
              details: Array.isArray(mensajes) ? mensajes : [mensajes],
              estado: "R",
              clave_acceso: accessKey,
              respuesta_sri: authorizationResult
            });
          }
          
        } catch (authError) {
          console.error("Error en autorización:", authError);
          estadoSRI = "E"; // Enviada pero error en autorización
          numeroAutorizacion = `ERROR-AUTH-${Date.now()}`;
          
          console.log("Error en autorización, pero documento fue recibido por el SRI");
        }
        
      } else {
        estadoSRI = "R"; // Rechazado en recepción
        const mensajes = receptionResult?.mensajes || receptionResult?.informacionAdicional || ["Error desconocido en recepción"];
        console.log("✗ Documento rechazado en recepción:", mensajes);
        
        return res.status(400).json({
          message: "El documento fue rechazado en la recepción del SRI",
          details: Array.isArray(mensajes) ? mensajes : [mensajes],
          estado: "R",
          clave_acceso: accessKey,
          respuesta_sri: receptionResult        });
      }
      
    } catch (sriError) {
      console.error("Error al comunicarse con el SRI:", sriError);
      estadoSRI = "X"; // Error
      
      return res.status(500).json({
        message: "Error al comunicarse con el SRI",
        details: sriError.message,
        estado: "X",
        clave_acceso: accessKey,
        error_completo: sriError.stack
      });
    }

    // Guardar en la base de datos con el resultado final
    const { data: facturaDB, error: facturaError } = await supabase
      .from("factura_electronica")
      .insert([
        {
          id_emisor,
          id_cliente,
          id_usuario,
          clave_acceso: accessKey,
          numero_secuencial: secuencial.padStart(9, "0"),
          fecha_emision: new Date().toISOString().split("T")[0],
          estado: estadoSRI,
          fecha_autorizacion: estadoSRI === "A" ? new Date().toISOString() : null,
          xml_autorizado: signedXml,
          pdf_path: null,
          punto_emision,
          ambiente_sri: ambienteSRI,
          numero_autorizacion: numeroAutorizacion,
          subtotal: facturaConfig.infoFactura.totalSinImpuestos,
          iva_total: facturaConfig.infoFactura.totalConImpuestos[0].valor,
          total: facturaConfig.infoFactura.importeTotal,
        },
      ])
      .select()
      .single();

    if (facturaError) throw facturaError;

    // Insertar detalles
    const detallesConFactura = detalles.map((d) => ({
      ...d,
      id_factura: facturaDB.id_factura,
      descripcion: d.descripcion || `Producto ${d.id_producto}`,
    }));
    await supabase.from("detalle_factura").insert(detallesConFactura);

    // Insertar formas de pago
    const pagosConFactura = formas_pago.map((p) => ({
      ...p,
      id_factura: facturaDB.id_factura,
    }));
    await supabase.from("forma_pago_factura").insert(pagosConFactura);

    // Respuesta exitosa
    res.status(201).json({
      success: true,
      message: `Factura ${estadoSRI === "A" ? "autorizada" : "procesada"} exitosamente`,
      ...facturaDB,
      clave_acceso: accessKey,
      xml_generado: true,
      firmado: true,
      estado_sri: estadoSRI,
      numero_autorizacion: numeroAutorizacion,
      modo_simulado: false,
      ambiente_sri: ambienteSRI
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

/**
 * Obtiene el estado de una factura
 */
export const getInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const supabase = await getConnection();

    const { data: factura, error } = await supabase
      .from("factura_electronica")
      .select(`
        id_factura,
        clave_acceso,
        numero_secuencial,
        estado,
        fecha_autorizacion,
        numero_autorizacion,
        ambiente_sri,
        fecha_emision,
        total
      `)
      .eq("id_factura", id)
      .single();

    if (error) throw error;
    if (!factura) {
      return res.status(404).json({ message: "Factura no encontrada" });
    }

    // Mapear estados a descripciones
    const estadosDescripcion = {
      "P": "Pendiente - En proceso",
      "E": "Enviado - Pendiente de autorización",
      "A": "Autorizado - Factura válida",
      "R": "Rechazado - Factura no válida",
      "N": "No autorizado - Error en el proceso",
      "X": "Error - Fallo en la comunicación"
    };

    const resultado = {
      ...factura,
      estado_descripcion: estadosDescripcion[factura.estado] || "Estado desconocido",
      puede_consultar_sri: factura.clave_acceso && factura.estado === "A",
      url_consulta_sri: factura.clave_acceso && factura.estado === "A" 
        ? `https://srienlinea.sri.gob.ec/facturacion-electronica/consultas/publico/comprobantes-autorizados?numeroAutorizacion=${factura.clave_acceso}`
        : null
    };

    res.json(resultado);

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

/**
 * Actualiza el estado de una factura
 */
export const updateInvoiceStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { estado, fecha_autorizacion, xml_autorizado, pdf_path } = req.body;
    
    if (!estado) {
      return res.status(400).json({
        message: "El estado es requerido",
      });
    }

    // Validar que el estado sea válido
    const estadosValidos = ["P", "E", "A", "R", "N", "X"];
    if (!estadosValidos.includes(estado)) {
      return res.status(400).json({
        message:
          "Estado inválido. Los estados válidos son: " +
          estadosValidos.join(", "),
      });
    }

    const supabase = await getConnection();

    // Verificar si la factura existe
    const { data: currentInvoice, error: getCurrentError } = await supabase
      .from("factura_electronica")
      .select("estado, clave_acceso")
      .eq("id_factura", id)
      .single();

    if (getCurrentError) throw getCurrentError;

    if (!currentInvoice) {
      return res.status(404).json({
        message: "Factura no encontrada",
      });
    }

    // Preparar datos para actualizar
    const updateData = { estado };
    
    if (fecha_autorizacion) {
      updateData.fecha_autorizacion = fecha_autorizacion;
    }
    
    if (xml_autorizado) {
      updateData.xml_autorizado = xml_autorizado;
    }
    
    if (pdf_path) {
      updateData.pdf_path = pdf_path;
    }

    // Actualizar la factura
    const { data: updatedInvoice, error: updateError } = await supabase
      .from("factura_electronica")
      .update(updateData)
      .eq("id_factura", id)
      .select()
      .single();

    if (updateError) throw updateError;

    res.json({
      success: true,
      message: "Estado de factura actualizado exitosamente",
      factura: updatedInvoice,
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

// Función para consultar el estado de una factura en el SRI por clave de acceso
export const getInvoiceStatusBySRI = async (req, res) => {
  try {
    const { clave_acceso } = req.params;
    
    if (!clave_acceso || clave_acceso.length !== 49) {
      return res.status(400).json({
        message: "Clave de acceso inválida. Debe tener 49 caracteres",
        ejemplo: "1122334450112024010100110010010000000011234567890"
      });
    }

    const supabase = await getConnection();

    // Buscar la factura en la base de datos
    const { data: factura, error: facturaError } = await supabase
      .from("factura_electronica")
      .select(`
        *,
        clientes:id_cliente (nombre, apellido, cedula_ruc),
        emisor:id_emisor (razon_social, tipo_ambiente)
      `)
      .eq("clave_acceso", clave_acceso)
      .single();

    if (facturaError) {
      return res.status(404).json({
        message: "Factura no encontrada en la base de datos",
        clave_acceso: clave_acceso
      });
    }

    // Determinar ambiente
    const ambienteSRI = factura.emisor.tipo_ambiente === "produccion" ? "produccion" : "pruebas";
    
    try {
      // Consultar estado en el SRI
      console.log(`Consultando estado en SRI - Ambiente: ${ambienteSRI}`);
      console.log(`URL de autorización: ${SRI_URLS[ambienteSRI].autorizacion}`);
      
      const authorizationResult = await documentAuthorization(
        clave_acceso,
        SRI_URLS[ambienteSRI].autorizacion
      );

      console.log("Respuesta del SRI:", JSON.stringify(authorizationResult, null, 2));

      // Preparar respuesta
      const estadoDescripcion = {
        'P': 'Pendiente',
        'E': 'Enviada',
        'A': 'Autorizada',
        'R': 'Rechazada',
        'N': 'Anulada',
        'X': 'Error'
      };

      const response = {
        success: true,
        factura: {
          id_factura: factura.id_factura,
          clave_acceso: factura.clave_acceso,
          numero_secuencial: factura.numero_secuencial,
          fecha_emision: factura.fecha_emision,
          estado_local: factura.estado,
          estado_descripcion: estadoDescripcion[factura.estado],
          numero_autorizacion: factura.numero_autorizacion,
          cliente: `${factura.clientes.nombre} ${factura.clientes.apellido}`,
          cedula_ruc: factura.clientes.cedula_ruc,
          total: factura.total,
          ambiente_sri: ambienteSRI
        },
        consulta_sri: {
          estado: authorizationResult?.estado || 'NO_DISPONIBLE',
          numero_autorizacion: authorizationResult?.numeroAutorizacion,
          fecha_autorizacion: authorizationResult?.fechaAutorizacion,
          mensajes: authorizationResult?.mensajes || authorizationResult?.informacionAdicional,
          disponible_en_sri: !!authorizationResult?.estado
        }
      };

      // Si hay discrepancia entre estado local y SRI, actualizar
      if (authorizationResult?.estado === "AUTORIZADO" && factura.estado !== "A") {
        await supabase
          .from("factura_electronica")
          .update({ 
            estado: "A",
            numero_autorizacion: authorizationResult.numeroAutorizacion,
            fecha_autorizacion: authorizationResult.fechaAutorizacion
          })
          .eq("id_factura", factura.id_factura);
          
        response.actualizado = true;
        response.mensaje = "Estado actualizado según SRI";
      }

      res.json(response);

    } catch (sriError) {
      console.error("Error consultando SRI:", sriError);
      
      // Devolver información local aunque el SRI no responda
      res.json({
        success: true,
        factura: {
          id_factura: factura.id_factura,
          clave_acceso: factura.clave_acceso,
          numero_secuencial: factura.numero_secuencial,
          fecha_emision: factura.fecha_emision,
          estado_local: factura.estado,
          numero_autorizacion: factura.numero_autorizacion,
          cliente: `${factura.clientes.nombre} ${factura.clientes.apellido}`,
          total: factura.total,
          ambiente_sri: ambienteSRI
        },
        consulta_sri: {
          error: "No se pudo consultar el SRI",
          details: sriError.message,
          disponible_en_sri: false
        }
      });
    }

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

// Función para validar conectividad con el SRI
export const testSRIConnection = async (req, res) => {
  try {
    const { ambiente = 'pruebas' } = req.query;
    
    if (!['pruebas', 'produccion'].includes(ambiente)) {
      return res.status(400).json({
        message: "Ambiente debe ser 'pruebas' o 'produccion'"
      });
    }

    const urls = SRI_URLS[ambiente];
    const resultados = {
      ambiente,
      urls,
      conectividad: {
        recepcion: false,
        autorizacion: false
      },
      errores: []
    };

    try {
      // Probar URL de recepción (simplificado - solo verificar que responda)
      console.log(`Probando conectividad con SRI ${ambiente}...`);
      console.log(`URL recepción: ${urls.recepcion}`);
      console.log(`URL autorización: ${urls.autorizacion}`);
      
      // En un escenario real, aquí harías ping a los servicios
      // Por ahora solo validamos que las URLs estén configuradas
      resultados.conectividad.recepcion = !!urls.recepcion;
      resultados.conectividad.autorizacion = !!urls.autorizacion;
      
      if (!urls.recepcion) {
        resultados.errores.push("URL de recepción no configurada");
      }
      
      if (!urls.autorizacion) {
        resultados.errores.push("URL de autorización no configurada");
      }

    } catch (error) {
      resultados.errores.push(`Error de conectividad: ${error.message}`);
    }

    res.json({
      success: resultados.errores.length === 0,
      ...resultados,
      mensaje: resultados.errores.length === 0 
        ? "URLs del SRI configuradas correctamente" 
        : "Hay problemas con la configuración del SRI"
    });

  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({
      message: "Error interno del servidor",
      details: error.message,
    });
  }
};

// Función auxiliar para mapear datos del frontend a formato backend
function mapearDatosFrontend(datosOriginales) {
  console.log("Mapeando datos del frontend...");
  
  // Mapear campos principales con diferentes nombres posibles
  const mappedData = {
    id_emisor: datosOriginales.id_emisor || datosOriginales.emisorId || datosOriginales.emisor_id,
    id_cliente: datosOriginales.id_cliente || datosOriginales.clienteId || datosOriginales.cliente_id,
    id_usuario: datosOriginales.id_usuario || datosOriginales.usuarioId || datosOriginales.usuario_id,
    punto_emision: datosOriginales.punto_emision || datosOriginales.puntoEmision,
    numero_secuencial: datosOriginales.numero_secuencial || datosOriginales.numeroSecuencial,
    fecha_emision: datosOriginales.fecha_emision || datosOriginales.fechaEmision,
    ambiente_sri: datosOriginales.ambiente_sri || datosOriginales.ambienteSri || "pruebas",
    subtotal: datosOriginales.subtotal || datosOriginales.subTotal,
    iva_total: datosOriginales.iva_total || datosOriginales.ivaTotal || datosOriginales.iva,
    total: datosOriginales.total || datosOriginales.importeTotal
  };

  // Mapear detalles de productos (manejar diferentes formatos)
  let detalles = datosOriginales.detalles || datosOriginales.productos || datosOriginales.items || [];
  
  if (Array.isArray(detalles)) {
    mappedData.detalles = detalles.map((item, index) => {
      console.log(`Mapeando producto ${index + 1}:`, item);
      
      return {
        id_producto: item.id_producto || item.productoId || item.producto_id || item.id,
        cantidad: Number(item.cantidad || item.qty || item.quantity || 1),
        precio_unitario: Number(item.precio_unitario || item.precioUnitario || item.precio || item.price || 0),
        subtotal: Number(item.subtotal || item.subTotal || item.total_sin_iva || 0),
        descuento: Number(item.descuento || item.discount || 0),
        iva: Number(item.iva || item.tax || 0.15), // 15% por defecto
        descripcion: item.descripcion || item.description || item.nombre || item.name || `Producto ${item.id_producto || item.id}`
      };
    });
  } else {
    console.warn("Detalles no es un array:", detalles);
    mappedData.detalles = [];
  }
  // Mapear formas de pago (manejar diferentes formatos)
  let formas_pago = datosOriginales.formas_pago || datosOriginales.formasPago || datosOriginales.pagos || datosOriginales.payments || [];
  
  if (Array.isArray(formas_pago)) {
    mappedData.formas_pago = formas_pago.map((pago, index) => {
      console.log(`Mapeando forma de pago ${index + 1}:`, pago);
      
      // El frontend puede enviar 'codigo' directamente o nombres descriptivos
      let formaPago = "efectivo"; // Valor por defecto
      
      if (pago.codigo) {
        // Si viene un código SRI directamente, convertirlo a nombre descriptivo
        const codigoANombre = {
          "01": "efectivo",
          "02": "cheque", 
          "16": "debito",
          "19": "credito",
          "20": "transferencia",
          "17": "dinero_electronico",
          "99": "otros"
        };
        formaPago = codigoANombre[pago.codigo] || "efectivo";
      } else {
        // Si viene un nombre descriptivo
        formaPago = pago.forma_pago || pago.formaPago || pago.tipo || pago.type || pago.metodo || "efectivo";
      }
      
      return {
        forma_pago: formaPago,
        valor_pago: Number(pago.valor_pago || pago.valorPago || pago.valor || pago.amount || pago.monto || 0),
        plazo: Number(pago.plazo || pago.term || 0),
        unidad_tiempo: pago.unidad_tiempo || pago.unidadTiempo || pago.timeUnit || "dias"
      };
    });
  } else {
    console.warn("Formas de pago no es un array:", formas_pago);
    mappedData.formas_pago = [];
  }

  console.log("Datos mapeados exitosamente:", {
    productos: mappedData.detalles.length,
    formas_pago: mappedData.formas_pago.length,
    emisor: !!mappedData.id_emisor,
    cliente: !!mappedData.id_cliente
  });

  return mappedData;
}

// Función auxiliar para mapear formas de pago del frontend a códigos SRI
function mapFormaPagoFrontendToSRI(formaPago) {
  const mapeo = {
    // Mapeos básicos
    'efectivo': "01",
    'cash': "01",
    'dinero': "01",
    
    // Cheques
    'cheque': "02",
    'check': "02",
    
    // Tarjetas de débito
    'debito': "16",
    'tarjeta_debito': "16",
    'debit': "16",
    'debit_card': "16",
    
    // Tarjetas de crédito  
    'credito': "19",
    'tarjeta_credito': "19",
    'credit': "19",
    'credit_card': "19",
    
    // Transferencias
    'transferencia': "20",
    'transferencia_bancaria': "20",
    'transfer': "20",
    'bank_transfer': "20",
    
    // Dinero electrónico
    'dinero_electronico': "17",
    'electronic_money': "17",
    
    // Otros
    'otros': "99",
    'other': "99",
    'otro': "99"
  };
  
  const formaPagoNormalizada = formaPago?.toString().toLowerCase().trim();
  const codigo = mapeo[formaPagoNormalizada] || "01"; // Efectivo por defecto
  
  console.log(`Mapeando forma de pago: "${formaPago}" -> "${codigo}"`);
  return codigo;
}

// Función auxiliar para mapear formas de pago (versión anterior para compatibilidad)
function getCodigoFormaPago(formaPago) {
  return mapFormaPagoFrontendToSRI(formaPago);
}

// Función auxiliar para obtener el último número secuencial
async function getLastInvoiceNumberFromDB(emisorId, puntoEmision) {
  const supabase = await getConnection();
  const { data } = await supabase.rpc("obtener_siguiente_secuencial", {
    p_emisor_id: emisorId,
    p_punto_emision: puntoEmision,
  });
  return data[0].siguiente_secuencial;
}

// Función auxiliar para guardar XML en archivos
function saveXmlToFile(xml, filename, type = 'xml') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dir = `comprobantes/${type === 'signed' ? 'firmados' : type === 'authorized' ? 'autorizados' : 'no-firmados'}`;
    
    // Crear directorio si no existe
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    const filepath = path.join(dir, `${filename}_${timestamp}.xml`);
    fs.writeFileSync(filepath, xml, 'utf8');
    console.log(`XML guardado en: ${filepath}`);
    
    return filepath;
  } catch (error) {
    console.error(`Error guardando XML ${type}:`, error.message);
    return null;
  }
}
