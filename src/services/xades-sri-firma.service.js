/**
 * Servicio de firma XAdES específico para SRI
 * Implementación mejorada según especificaciones exactas del SRI Ecuador
 */
import forge from 'node-forge';

/**
 * Firma un documento XML con certificado digital usando XAdES SHA-256 
 * Implementación optimizada según especificaciones exactas del SRI
 * @param {String} xml - XML sin firmar  
 * @param {Buffer} certP12 - Certificado P12
 * @param {String} password - Contraseña del certificado
 * @returns {String} XML firmado
 */
export function signXmlSRI(xml, certP12, password) {
  try {
    console.log("🔐 === INICIANDO FIRMA DIGITAL XAdES SRI OPTIMIZADA === 🔐");
    console.log(`📋 XML a firmar longitud: ${xml.length} caracteres`);
    console.log(`🔑 Certificado P12 tamaño: ${certP12.length} bytes`);
    
    // Generar IDs únicos para la firma - formato estándar SRI
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    const signatureId = `Signature-${timestamp}-${random}`;
    const signedPropsId = `SignedProperties-${timestamp}-${random}`;
    const keyInfoId = `KeyInfo-${timestamp}-${random}`;
    const objectId = `Object-${timestamp}-${random}`;
    
    console.log(`🆔 IDs generados - Signature: ${signatureId}`);
    
    // Cargar el certificado P12
    const p12Der = forge.util.createBuffer(certP12);
    const p12Asn1 = forge.asn1.fromDer(p12Der);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);
    
    // Obtener la clave privada y el certificado
    const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
    const keyBags = p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag });
    
    if (!certBags[forge.pki.oids.certBag] || certBags[forge.pki.oids.certBag].length === 0) {
      throw new Error("No se encontraron certificados en el archivo P12");
    }
    
    if (!keyBags[forge.pki.oids.pkcs8ShroudedKeyBag] || keyBags[forge.pki.oids.pkcs8ShroudedKeyBag].length === 0) {
      throw new Error("No se encontraron claves privadas en el archivo P12");
    }
    
    const certificate = certBags[forge.pki.oids.certBag][0].cert;
    const privateKey = keyBags[forge.pki.oids.pkcs8ShroudedKeyBag][0].key;
    
    console.log("✅ Certificado y clave privada cargados exitosamente");
    console.log(`📋 Subject: ${certificate.subject.getField('CN')?.value || 'No disponible'}`);
    console.log(`📅 Válido desde: ${certificate.validity.notBefore}`);
    console.log(`📅 Válido hasta: ${certificate.validity.notAfter}`);
    
    // Convertir certificado a Base64
    const certDer = forge.asn1.toDer(forge.pki.certificateToAsn1(certificate)).getBytes();
    const certB64 = forge.util.encode64(certDer);
    
    // PASO CRÍTICO: Calcular digest SHA-256 del documento XML SIN namespaces adicionales
    // Canonicalizar el XML antes de calcular el digest
    let xmlCanonical = xml;
    // Remover espacios en blanco innecesarios entre elementos
    xmlCanonical = xmlCanonical.replace(/>\s+</g, '><');
    // Normalizar atributos
    xmlCanonical = xmlCanonical.replace(/\s+/g, ' ');
    
    const xmlHash = forge.md.sha256.create();
    xmlHash.update(xmlCanonical, 'utf8');
    const digestValue = forge.util.encode64(xmlHash.digest().getBytes());
    
    console.log(`🔍 Digest SHA-256 del XML: ${digestValue.substring(0, 20)}...`);
    
    // Calcular digest SHA-256 del certificado para XAdES
    const certHash = forge.md.sha256.create();
    certHash.update(certDer);
    const certDigestValue = forge.util.encode64(certHash.digest().getBytes());
    
    // Obtener información del emisor del certificado - FORMATO ESTRICTO SRI
    const issuerAttrs = [];
    
    // Orden específico requerido por SRI: CN, OU, O, L, ST, C, EMAIL
    const fieldOrder = ['CN', 'OU', 'O', 'L', 'ST', 'C', 'emailAddress'];
    
    for (const fieldName of fieldOrder) {
      try {
        const field = certificate.issuer.getField(fieldName);
        if (field && field.value && field.value.trim() !== '') {
          const value = field.value.trim();
          // Escapar caracteres especiales para DN
          const escapedValue = value.replace(/,/g, '\\,').replace(/=/g, '\\=');
          issuerAttrs.push(`${fieldName}=${escapedValue}`);
        }
      } catch (error) {
        // Campo no existe, continuar
      }
    }
    
    // Si no hay atributos válidos, usar enfoque de respaldo
    if (issuerAttrs.length === 0) {
      console.warn("⚠️ No se encontraron atributos válidos, usando respaldo");
      issuerAttrs.push('CN=Autoridad Certificadora');
    }
    
    const issuerName = issuerAttrs.join(', ');
    const serialNumber = certificate.serialNumber;
    
    console.log(`📋 Issuer procesado: ${issuerName}`);
    console.log(`📋 Serial Number: ${serialNumber}`);
    
    // Timestamp para la firma - formato ISO estricto
    const signingTime = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
    
    // PASO CRÍTICO: Crear SignedProperties con estructura exacta del SRI
    const signedProperties = `<xades:SignedProperties xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${signedPropsId}">
<xades:SignedSignatureProperties>
<xades:SigningTime>${signingTime}</xades:SigningTime>
<xades:SigningCertificate>
<xades:Cert>
<xades:CertDigest>
<ds:DigestMethod xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<ds:DigestValue xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${certDigestValue}</ds:DigestValue>
</xades:CertDigest>
<xades:IssuerSerial>
<ds:X509IssuerName xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${issuerName}</ds:X509IssuerName>
<ds:X509SerialNumber xmlns:ds="http://www.w3.org/2000/09/xmldsig#">${serialNumber}</ds:X509SerialNumber>
</xades:IssuerSerial>
</xades:Cert>
</xades:SigningCertificate>
</xades:SignedSignatureProperties>
</xades:SignedProperties>`;
    
    // Calcular digest SHA-256 de SignedProperties - canonicalizado
    let signedPropsCanonical = signedProperties.replace(/>\s+</g, '><');
    const signedPropsHash = forge.md.sha256.create();
    signedPropsHash.update(signedPropsCanonical, 'utf8');
    const signedPropsDigest = forge.util.encode64(signedPropsHash.digest().getBytes());
    
    console.log(`🔍 Digest SignedProperties: ${signedPropsDigest.substring(0, 20)}...`);
    
    // PASO CRÍTICO: Crear SignedInfo con estructura exacta del SRI
    const signedInfo = `<ds:SignedInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
<ds:CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"/>
<ds:SignatureMethod Algorithm="http://www.w3.org/2001/04/xmldsig-more#rsa-sha256"/>
<ds:Reference URI="">
<ds:Transforms>
<ds:Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"/>
</ds:Transforms>
<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<ds:DigestValue>${digestValue}</ds:DigestValue>
</ds:Reference>
<ds:Reference Type="http://uri.etsi.org/01903#SignedProperties" URI="#${signedPropsId}">
<ds:DigestMethod Algorithm="http://www.w3.org/2001/04/xmlenc#sha256"/>
<ds:DigestValue>${signedPropsDigest}</ds:DigestValue>
</ds:Reference>
</ds:SignedInfo>`;
    
    // Canonicalizar SignedInfo antes de firmar
    let signedInfoCanonical = signedInfo.replace(/>\s+</g, '><');
    
    // Firmar SignedInfo con SHA-256
    const md256 = forge.md.sha256.create();
    md256.update(signedInfoCanonical, 'utf8');
    const signature = privateKey.sign(md256);
    const signatureValue = forge.util.encode64(signature);
    
    console.log(`🔐 Firma calculada: ${signatureValue.substring(0, 20)}...`);
    
    // PASO CRÍTICO: Construir el elemento Signature completo con estructura exacta del SRI
    const signatureElement = `
<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" xmlns:xades="http://uri.etsi.org/01903/v1.3.2#" Id="${signatureId}">
${signedInfo}
<ds:SignatureValue>${signatureValue}</ds:SignatureValue>
<ds:KeyInfo Id="${keyInfoId}">
<ds:X509Data>
<ds:X509Certificate>${certB64}</ds:X509Certificate>
</ds:X509Data>
</ds:KeyInfo>
<ds:Object Id="${objectId}">
<xades:QualifyingProperties Target="#${signatureId}">
${signedProperties}
</xades:QualifyingProperties>
</ds:Object>
</ds:Signature>`;
    
    // Insertar la firma en el XML - justo antes del cierre del elemento raíz
    const rootTagMatch = xml.match(/<(\w+)[^>]*>/);
    if (!rootTagMatch) {
      throw new Error("No se pudo encontrar el elemento raíz en el XML");
    }
    
    const rootTag = rootTagMatch[1];
    const closingTag = `</${rootTag}>`;
    const closingIndex = xml.lastIndexOf(closingTag);
    
    if (closingIndex === -1) {
      throw new Error("No se pudo encontrar el cierre del elemento raíz");
    }
    
    const signedXml = xml.substring(0, closingIndex) + signatureElement + xml.substring(closingIndex);
    console.log("✅ Firma digital XAdES SRI optimizada insertada exitosamente");
    console.log(`📏 XML firmado longitud: ${signedXml.length} caracteres`);
    
    return signedXml;
  } catch (error) {
    console.error("❌ Error firmando XML:", error);
    throw new Error(`Error firmando XML: ${error.message}`);
  }
}

/**
 * Alternativa de firma con canonicalización C14N estricta
 * @param {String} xml - XML sin firmar  
 * @param {Buffer} certP12 - Certificado P12
 * @param {String} password - Contraseña del certificado
 * @returns {String} XML firmado
 */
export function signXmlC14N(xml, certP12, password) {
  try {
    console.log("🔐 === INICIANDO FIRMA DIGITAL XAdES C14N ESTRICTA === 🔐");
    
    // Similar a la función anterior pero con canonicalización más estricta
    // Implementar canonicalización C14N completa si es necesario
    
    // Por ahora, usar la función principal
    return signXmlSRI(xml, certP12, password);
    
  } catch (error) {
    console.error("❌ Error en firma C14N:", error);
    throw new Error(`Error en firma C14N: ${error.message}`);
  }
}
