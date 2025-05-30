import { getConnection } from "../database/connection.js";

export const getEmisores = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("emisor")
      .select("*")
      .order("id_emisor");

    if (error) throw error;
    res.json(data || []);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};

export const getEmisor = async (req, res) => {
  try {
    const supabase = await getConnection();
    const { data, error } = await supabase
      .from("emisor")
      .select("*")
      .eq("id_emisor", req.params.id)
      .single();

    if (error) throw error;
    if (!data) {
      return res.status(404).json({ message: "Emisor not found" });
    }
    return res.json(data);
  } catch (error) {
    console.error("Error:", error);
    res
      .status(500)
      .json({ message: "Error interno del servidor", details: error.message });
  }
};
