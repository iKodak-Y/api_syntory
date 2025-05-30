import sql from 'mssql';

const dbSettings = {
    user: "sa",
    password: "admin",
    server: "localhost",
    database: "Syntory",
    options: {
        encrypt: false,
        trustServerCertificate: true,
    
    }
};
export const getConnection = async () => {
    try {
        const pool = await sql.connect(dbSettings)
        return pool;
    } catch (error) {
        console.log(error);
    }
};