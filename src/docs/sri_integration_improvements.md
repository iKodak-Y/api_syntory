# Mejoras en la Integración con el SRI

## Resumen de Cambios

### 1. Firma XML Mejorada
- **Múltiples métodos de firma**: Se implementaron 4 métodos diferentes para firmar el XML, aumentando la compatibilidad con diferentes versiones de `open-factura`
- **Validación de certificado**: Se verifica que el certificado existe, no está vacío y tiene una contraseña válida
- **Validación de XML**: Se verifica que el XML generado sea válido antes de intentar firmarlo
- **Manejo robusto de errores**: Cada método de firma tiene su propio manejo de errores con fallback al siguiente método

### 2. Comunicación SRI Mejorada
- **URLs configurables**: Se definieron URLs específicas para pruebas y producción
- **Manejo de estados mejorado**: Se manejan diferentes estados de respuesta del SRI (RECIBIDA, AUTORIZADO, EN_PROCESAMIENTO, etc.)
- **Timeout y reintentos**: Se agregó un delay entre recepción y autorización para permitir procesamiento del SRI
- **Logging detallado**: Se registra cada paso de la comunicación con el SRI

### 3. Almacenamiento de Archivos
- **Guardado automático**: Los XML se guardan automáticamente en carpetas organizadas:
  - `comprobantes/no-firmados/` - XML generados sin firma
  - `comprobantes/firmados/` - XML firmados digitalmente  
  - `comprobantes/autorizados/` - XML autorizados por el SRI
- **Nombres con timestamp**: Cada archivo incluye fecha y hora para evitar conflictos
- **Respaldo para debugging**: Facilita la revisión y depuración de documentos

### 4. Nuevos Endpoints
- **GET /api/v1/invoices/sri-status/:clave_acceso**: Consulta el estado de una factura directamente en el SRI
- **GET /api/v1/invoices/sri/test-connection**: Prueba la conectividad con los servicios del SRI
- **Sincronización automática**: Si hay diferencias entre el estado local y del SRI, se actualiza automáticamente

## Flujo de Procesamiento Mejorado

### Modo Simulado (Sin Certificado)
1. Generar factura con `open-factura`
2. Crear XML sin firma
3. Guardar con estado "A" (Autorizado simulado)
4. Retornar respuesta inmediata

### Modo Producción (Con Certificado)
1. Generar factura con `open-factura`
2. Validar XML generado
3. Guardar XML sin firma
4. **Firma Digital**:
   - Método 1: Certificado cargado con `getP12FromLocalFile`
   - Método 2: Path del certificado directamente
   - Método 3: Buffer del certificado
   - Método 4: Parámetros posicionales
5. Validar XML firmado
6. Guardar XML firmado
7. **Envío al SRI**:
   - Recepción del documento
   - Espera de procesamiento (2 segundos)
   - Solicitud de autorización
8. Procesar respuesta del SRI
9. Guardar XML autorizado (si aplica)
10. Actualizar base de datos con resultado

## Manejo de Errores

### Errores de Firma
- Se prueban múltiples métodos antes de fallar
- Se reportan todos los errores para debugging
- Se incluye información del certificado (tamaño, existencia)

### Errores del SRI
- Se distingue entre errores de recepción y autorización
- Se guardan las respuestas completas del SRI
- Se manejan timeouts y errores de conexión

### Errores de Base de Datos
- Rollback automático en caso de falla
- Logging detallado de operaciones SQL

## Testing y Debugging

### Archivos de Prueba
Los XML generados se guardan para permitir:
- Verificación manual de la estructura
- Debugging de problemas de firma
- Comparación entre versiones
- Respaldo para reenvío manual

### Logging Mejorado
- Timestamps en todos los logs
- Información detallada de cada paso
- Stack traces completos en errores
- Respuestas del SRI completas

## Próximos Pasos Recomendados

1. **Probar con certificado real**: El código está preparado para manejar certificados reales
2. **Validar en ambiente de pruebas**: Usar el endpoint de test de conectividad
3. **Monitorear logs**: Revisar los logs detallados para identificar patrones
4. **Implementar alertas**: Configurar notificaciones para errores recurrentes
5. **Optimizar rendimiento**: Analizar tiempos de respuesta y optimizar según sea necesario

## Configuración Requerida

### Certificado Digital
- Archivo .p12 válido en la ruta especificada
- Contraseña del certificado configurada
- Permisos de lectura en el archivo

### Base de Datos
- Campo `ambiente_sri` configurado ('pruebas' o 'produccion')
- Campos de certificado (`certificado_path`, `contrasena_certificado`)
- Índices en `clave_acceso` para consultas rápidas

### Infraestructura
- Carpetas de comprobantes creadas con permisos de escritura
- Conectividad HTTPS hacia los servicios del SRI
- Suficiente espacio en disco para archivos XML
