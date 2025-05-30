# Guía de Consultas con Supabase

Esta guía contiene ejemplos de cómo realizar diferentes tipos de consultas usando Supabase.

## 1. Consultas Básicas SELECT

### Seleccionar todos los registros
```javascript
const { data, error } = await supabase
  .from('tabla')
  .select('*')
```

### Seleccionar campos específicos
```javascript
const { data, error } = await supabase
  .from('tabla')
  .select('campo1, campo2, campo3')
```

### Seleccionar un solo registro
```javascript
const { data, error } = await supabase
  .from('tabla')
  .select('*')
  .single()  // Devuelve un objeto en lugar de un array
```

## 2. Filtros

### Igual a (=)
```javascript
.eq('campo', valor)
```

### Mayor que (>)
```javascript
.gt('campo', valor)
```

### Menor que (<)
```javascript
.lt('campo', valor)
```

### Mayor o igual que (>=)
```javascript
.gte('campo', valor)
```

### Menor o igual que (<=)
```javascript
.lte('campo', valor)
```

### LIKE (case sensitive)
```javascript
.like('campo', '%valor%')
```

### ILIKE (case insensitive)
```javascript
.ilike('campo', '%valor%')
```

### IN
```javascript
.in('campo', ['valor1', 'valor2', 'valor3'])
```

### Múltiples condiciones
```javascript
.eq('campo1', valor1)
.gt('campo2', valor2)
```

## 3. Ordenamiento

### Orden ascendente
```javascript
.order('campo')
// o
.order('campo', { ascending: true })
```

### Orden descendente
```javascript
.order('campo', { ascending: false })
```

### Múltiples campos de ordenamiento
```javascript
.order('campo1', { ascending: true })
.order('campo2', { ascending: false })
```

## 4. Relaciones y Joins

### Join simple
```javascript
.from('tabla')
.select(`
  *,
  otra_tabla:campo_foreign_key (campo1, campo2)
`)
```

### Join múltiple
```javascript
.from('tabla')
.select(`
  *,
  tabla1:foreign_key1 (campo1, campo2),
  tabla2:foreign_key2 (campo1, campo2)
`)
```

### Join con todos los campos
```javascript
.from('tabla')
.select(`
  *,
  tabla_relacionada:foreign_key (*)
`)
```

## 5. Inserción de Datos

### Insertar un registro
```javascript
const { data, error } = await supabase
  .from('tabla')
  .insert([{ 
    campo1: valor1,
    campo2: valor2
  }])
  .select()  // Para obtener el registro insertado
```

### Insertar múltiples registros
```javascript
const { data, error } = await supabase
  .from('tabla')
  .insert([
    { campo1: valor1 },
    { campo1: valor2 }
  ])
  .select()
```

## 6. Actualización de Datos

### Actualizar registros
```javascript
const { data, error } = await supabase
  .from('tabla')
  .update({ campo: nuevo_valor })
  .eq('id', id)
  .select()
```

### Actualizar con múltiples condiciones
```javascript
const { data, error } = await supabase
  .from('tabla')
  .update({ campo: nuevo_valor })
  .eq('campo1', valor1)
  .eq('campo2', valor2)
  .select()
```

## 7. Eliminación de Datos

### Eliminar un registro
```javascript
const { error } = await supabase
  .from('tabla')
  .delete()
  .eq('id', id)
```

### Eliminar con condición
```javascript
const { error } = await supabase
  .from('tabla')
  .delete()
  .eq('campo', valor)
```

## 8. Paginación

### Limitar resultados
```javascript
.from('tabla')
.select('*')
.range(0, 9)  // Primeros 10 registros
```

### Paginación con offset
```javascript
.from('tabla')
.select('*')
.range(10, 19)  // Siguiente página de 10 registros
```

## 9. Manejo de Errores

```javascript
try {
  const { data, error } = await supabase
    .from('tabla')
    .select('*')

  if (error) throw error;
  
  // Procesar data
} catch (error) {
  console.error('Error:', error.message);
  // Manejar el error
}
```

## 10. Buenas Prácticas

1. Siempre maneja los errores con try/catch
2. Usa `.select()` después de `.insert()` o `.update()` si necesitas los datos
3. Proporciona valores por defecto: `data || []`
4. Usa `.single()` cuando esperes un solo registro
5. Usa el operador opcional (?.) al acceder a propiedades que podrían ser null

## 11. Ejemplos de Casos Reales

### Consulta compleja con joins y transformación
```javascript
const { data, error } = await supabase
  .from('factura_electronica')
  .select(`
    *,
    clientes:id_cliente (nombre, apellido),
    emisor:id_emisor (razon_social),
    detalle_factura (total)
  `)
  .order('fecha_emision', { ascending: false })

const facturas = data?.map(factura => ({
  ...factura,
  cliente_nombre: `${factura.clientes?.nombre} ${factura.clientes?.apellido}`,
  total: factura.detalle_factura?.reduce((sum, d) => sum + d.total, 0)
})) || []
```

### Actualización con validación
```javascript
const { data, error } = await supabase
  .from('productos')
  .update({ stock: stock - cantidad })
  .eq('id', producto_id)
  .gt('stock', cantidad)  // Solo actualiza si hay suficiente stock
  .select()
```
