import { getConnection } from "../database/connection.js";

/**
 * Obtiene todos los clientes activos ordenados por ID
 */
export const getClients = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase      .from('clientes')
      .select('*')
      .eq('estado', 'S')
      .order('id_cliente');

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

/**
 * Obtiene un cliente por su ID
 */
export const getClient = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('id_cliente', req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    return res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

/**
 * Busca un cliente por su número de identificación (cédula o RUC)
 */
export const findClientByIdentification = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('cedula_ruc', req.params.identification)
      .eq('estado', 'A')
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }
    return res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ message: "Error interno del servidor", details: error.message });
  }
};

/**
 * Crea un nuevo cliente
 */
export const createClient = async (req, res) => {
  try {
    const { nombre, apellido, cedula_ruc, direccion, telefono, email } = req.body;

    // Validaciones básicas
    if (!nombre || !cedula_ruc) {
      return res.status(400).json({
        message: "Nombre y número de identificación son requeridos"
      });
    }

    const supabase = await getConnection();

    // Verificar si ya existe un cliente con esa identificación
    const { data: existingClient } = await supabase
      .from('clientes')
      .select('cedula_ruc')
      .eq('cedula_ruc', cedula_ruc)
      .single();

    if (existingClient) {
      return res.status(400).json({
        message: "Ya existe un cliente con esta identificación"
      });
    }

    // Crear el nuevo cliente
    const { data, error } = await supabase
      .from('clientes')
      .insert([{
        nombre,
        apellido,
        cedula_ruc,
        direccion,
        telefono,
        email,        estado: 'S'
      }])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Actualiza la información de un cliente
 */
export const updateClient = async (req, res) => {
  try {
    const { nombre, apellido, direccion, telefono, email, estado } = req.body;
    const supabase = await getConnection();

    // Verificar si el cliente existe
    const { data: existingClient } = await supabase
      .from('clientes')
      .select('id_cliente')
      .eq('id_cliente', req.params.id)
      .single();

    if (!existingClient) {
      return res.status(404).json({
        message: "Cliente no encontrado"
      });
    }

    // Actualizar cliente
    const { data, error } = await supabase
      .from('clientes')
      .update({
        nombre,
        apellido,
        direccion,
        telefono,
        email,        estado: estado || 'S',
      })
      .eq('id_cliente', req.params.id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};

/**
 * Elimina lógicamente un cliente (cambio de estado a 'I')
 */
export const deleteClient = async (req, res) => {
  try {
    const supabase = await getConnection();

    // Verificar si existen facturas asociadas
    const { data: invoices, error: invoicesError } = await supabase
      .from('factura_electronica')
      .select('id_factura')
      .eq('id_cliente', req.params.id)
      .limit(1);

    if (invoicesError) throw invoicesError;

    if (invoices && invoices.length > 0) {
      return res.status(400).json({
        message: "No se puede eliminar el cliente porque tiene facturas asociadas"
      });
    }

    // Realizar eliminación lógica
    const { error } = await supabase
      .from('clientes')      .update({ estado: 'N' })
      .eq('id_cliente', req.params.id);

    if (error) throw error;
    return res.json({ message: "Cliente eliminado correctamente" });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      message: "Error interno del servidor", 
      details: error.message 
    });
  }
};
