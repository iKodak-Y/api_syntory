import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mfxlnmphnuretjlrhmsc.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1meGxubXBobnVyZXRqbHJobXNjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg2MTgyMzgsImV4cCI6MjA2NDE5NDIzOH0.GhVyCkXkfKTSgTzf_5EAgM2EuepHffatKH8gn-VBHNM';

const supabase = createClient(supabaseUrl, supabaseKey);

export const getConnection = async () => {
  try {
    return supabase;
  } catch (error) {
    console.error('Error al conectar con la base de datos:', error);
    throw error;
  }
};
