# Documentación de Estados de Facturación Electrónica

## Estados de Factura

### P - Pendiente
- Estado inicial cuando se crea una factura
- Indica que la factura está lista para ser enviada al SRI
- Siguiente estado posible: E (Enviada) o X (Error)

### E - Enviada
- La factura ha sido enviada al SRI y está en proceso de autorización
- Siguiente estado posible: A (Autorizada), R (Rechazada) o X (Error)

### A - Autorizada
- La factura ha sido autorizada por el SRI
- Tiene número de autorización y fecha de autorización
- Siguiente estado posible: N (Anulada)

### R - Rechazada
- El SRI ha rechazado la factura por algún motivo
- Se debe corregir y volver a enviar
- Siguiente estado posible: P (Pendiente) o X (Error)

### N - Anulada
- La factura ha sido anulada en el SRI
- Estado final, no se puede cambiar
- Requiere motivo de anulación

### X - Error
- Error técnico en el proceso
- Siguiente estado posible: P (Pendiente)

## Diagrama de Flujo de Estados

```
[P] Pendiente
  ├──> [E] Enviada
  │      ├──> [A] Autorizada
  │      │      └──> [N] Anulada (Final)
  │      ├──> [R] Rechazada
  │      │      └──> [P] Pendiente
  │      └──> [X] Error
  └──> [X] Error
        └──> [P] Pendiente
```

## Validaciones de Estado

### Al Crear Factura
- Se crea siempre en estado 'P' (Pendiente)
- Debe tener todos los campos requeridos
- El número secuencial debe ser único

### Al Enviar al SRI (P -> E)
- Debe estar en estado 'P'
- Debe tener XML generado
- Debe tener firma electrónica válida

### Al Recibir Respuesta del SRI (E -> A/R)
- Si es autorizada (A):
  - Guardar número de autorización
  - Guardar fecha de autorización
  - Guardar XML autorizado
- Si es rechazada (R):
  - Guardar motivo de rechazo
  - Registrar en log_errores_factura

### Al Anular Factura (A -> N)
- Solo se pueden anular facturas autorizadas (estado 'A')
- Requiere motivo de anulación
- Registrar en log_errores_factura
- Es un estado final

### En Caso de Error (-> X)
- Registrar error en log_errores_factura
- Permite volver a estado Pendiente para reintentar

## Consideraciones Importantes

1. **Irreversibilidad**: 
   - Una factura anulada (N) no puede cambiar a ningún otro estado
   - Una factura autorizada (A) solo puede pasar a anulada (N)

2. **Trazabilidad**:
   - Todos los cambios de estado deben ser registrados
   - Los errores y rechazos deben guardarse en log_errores_factura
   - Se debe mantener registro de fechas de cada cambio

3. **Validaciones**:
   - Cada cambio de estado debe validar la transición permitida
   - Cada estado tiene sus propios requisitos de datos
   - Se debe validar la integridad de los datos en cada transición

4. **Notificaciones**:
   - Los cambios de estado deben notificar al usuario
   - Los errores deben ser claros y específicos
   - Las acciones requeridas deben ser comunicadas
