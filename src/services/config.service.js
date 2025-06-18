import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

// Inicializar cliente Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Obtiene una variable de configuración del sistema
 * @param {string} key Clave de la configuración a buscar
 * @param {any} defaultValue Valor por defecto si la configuración no existe
 * @returns {Promise<any>} El valor de la configuración
 */
export const getConfigValue = async (key, defaultValue = null) => {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .select('valor, tipo')
      .eq('clave', key)
      .eq('activo', true)
      .single();

    if (error) {
      console.error(`Error al obtener configuración ${key}:`, error);
      return defaultValue;
    }

    if (!data) {
      console.warn(`Configuración ${key} no encontrada, usando valor por defecto:`, defaultValue);
      return defaultValue;
    }

    // Convertir valor según su tipo
    const valor = data.valor;
    switch (data.tipo?.toLowerCase()) {
      case 'number':
      case 'numero':
        return Number(valor);
      case 'boolean':
      case 'booleano':
        return valor === 'true' || valor === '1' || valor === 'si';
      case 'json':
        try {
          return JSON.parse(valor);
        } catch (e) {
          console.error(`Error al parsear JSON para configuración ${key}:`, e);
          return defaultValue;
        }
      default:
        return valor;
    }
  } catch (error) {
    console.error(`Error inesperado al obtener configuración ${key}:`, error);
    return defaultValue;
  }
};

/**
 * Obtiene el valor del IVA por defecto del sistema
 * @returns {Promise<number>} El porcentaje de IVA como decimal (ej: 0.15 para 15%)
 */
export const getDefaultIva = async () => {
  const iva = await getConfigValue('IVA_DEFAULT', 0.15);
  return typeof iva === 'number' ? iva : Number(iva);
};

/**
 * Actualiza una configuración del sistema
 * @param {string} key Clave de la configuración
 * @param {any} value Nuevo valor
 * @returns {Promise<boolean>} Éxito de la operación
 */
export const updateConfigValue = async (key, value) => {
  try {
    const { data, error } = await supabase
      .from('configuracion_sistema')
      .update({ valor: String(value), fecha_modificacion: new Date() })
      .eq('clave', key);

    if (error) {
      console.error(`Error al actualizar configuración ${key}:`, error);
      return false;
    }

    return true;
  } catch (error) {
    console.error(`Error inesperado al actualizar configuración ${key}:`, error);
    return false;
  }
};
