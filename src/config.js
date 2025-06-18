import dotenv from 'dotenv';
dotenv.config();

export default {  
  port: process.env.PORT || 3000,
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'syntory_app_secret_key',
  // Supabase configuration
  supabase: {    
    url: process.env.SUPABASE_URL || 'https://mfxlnmphnuretjlrhmsc.supabase.co',
    key: process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1meGxubXBobnVyZXRqbHJobXNjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0ODYxODIzOCwiZXhwIjoyMDY0MTk0MjM4fQ.-FgBiARKcnZIS-zMLmoTnbQR8wi9T4M7CUFAmvhoIGg',
    storage: {
      buckets: {
        facturas: 'syntorystorage',
        firmas: 'syntorystorage', 
        img: 'syntorystorage'
      },
      folders: {
        certificados: 'certificados',
        logos: 'logos',
        facturas: {
          autorizados: 'autorizados',
          firmados: 'firmados',
          noFirmados: 'no-firmados',
          pdf: 'pdf'
        }
      }
    }
  }
};
