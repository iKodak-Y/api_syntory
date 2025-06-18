import nodemailer from 'nodemailer';
import { getConnection } from '../database/connection.js';

/**
 * Servicio de email para envío de PDFs de ventas
 */
export class EmailService {
  constructor() {
    this.transporter = null;
  }
  /**
   * Obtener configuraciones de email desde la base de datos
   */
  async getEmailConfig() {
    try {
      const supabase = await getConnection();
      
      const { data: configs, error } = await supabase
        .from('configuracion_sistema')
        .select('clave, valor')
        .in('clave', [
          'email_remitente', 
          'email_password', 
          'correo_smtp_host', 
          'correo_smtp_port',
          'correo_envio_habilitado'
        ])
        .eq('activo', true);

      if (error) throw error;

      const configMap = {};
      configs.forEach(config => {
        configMap[config.clave] = config.valor;
      });

      return {
        emailRemitente: configMap.email_remitente,
        emailPassword: configMap.email_password,
        smtpHost: configMap.correo_smtp_host || 'smtp.gmail.com',
        smtpPort: parseInt(configMap.correo_smtp_port) || 587,
        envioHabilitado: configMap.correo_envio_habilitado === 'true'
      };
    } catch (error) {
      console.error('Error obteniendo configuraciones de email:', error);
      throw new Error('No se pudieron obtener las configuraciones de email');
    }
  }
  /**
   * Configurar el transporter de nodemailer
   */
  async setupTransporter() {
    try {
      const config = await this.getEmailConfig();

      // Verificar si el envío está habilitado
      if (!config.envioHabilitado) {
        throw new Error('El envío de correos está deshabilitado en la configuración');
      }

      if (!config.emailRemitente || !config.emailPassword) {
        throw new Error('Configuraciones de email incompletas');
      }

      console.log('Configurando email con:', {
        host: config.smtpHost,
        port: config.smtpPort,
        user: config.emailRemitente
      });

      this.transporter = nodemailer.createTransport({
        host: config.smtpHost,
        port: config.smtpPort,
        secure: false, // true para 465, false para otros puertos
        auth: {
          user: config.emailRemitente,
          pass: config.emailPassword
        },
        tls: {
          rejectUnauthorized: false
        }
      });

      // Verificar la configuración
      await this.transporter.verify();
      console.log('Configuración de email verificada correctamente');
      
      return this.transporter;
    } catch (error) {
      console.error('Error configurando transporter de email:', error);
      throw error;
    }
  }
  /**
   * Enviar PDF de venta al cliente
   */
  async enviarPDFVenta(ventaData) {
    try {
      console.log('=== INICIANDO ENVÍO DE PDF POR EMAIL ===');
      
      // Verificar configuración primero
      const config = await this.getEmailConfig();
      if (!config.envioHabilitado) {
        console.log('Envío de correos deshabilitado en configuración');
        return { success: false, message: 'Envío de correos deshabilitado' };
      }
      
      // Verificar que el cliente tenga email
      if (!ventaData.cliente_email || ventaData.cliente_email.trim() === '') {
        console.log('Cliente no tiene email registrado, omitiendo envío');
        return { success: false, message: 'Cliente no tiene email registrado' };
      }

      // Configurar transporter si no existe
      if (!this.transporter) {
        await this.setupTransporter();
      }

      // Configurar el email
      const mailOptions = {
        from: `"${ventaData.emisor_razon_social}" <${config.emailRemitente}>`,
        to: ventaData.cliente_email,
        subject: `Comprobante de Venta N° ${ventaData.numero_secuencial}`,
        html: this.generarHTMLEmail(ventaData),
        attachments: [
          {
            filename: `venta_${ventaData.numero_secuencial}.pdf`,
            path: ventaData.pdf_url, // URL de Supabase Storage
            contentType: 'application/pdf'
          }
        ]
      };

      // Enviar email
      const info = await this.transporter.sendMail(mailOptions);
      
      console.log('Email enviado exitosamente:', info.messageId);
      
      return {
        success: true,
        messageId: info.messageId,
        message: 'PDF enviado por email correctamente'
      };

    } catch (error) {
      console.error('Error enviando email:', error);
      return {
        success: false,
        message: `Error enviando email: ${error.message}`
      };
    }
  }

  /**
   * Generar HTML para el email
   */
  generarHTMLEmail(ventaData) {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; text-align: center; border-radius: 5px; }
          .content { margin: 20px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
          .highlight { background-color: #e7f3ff; padding: 10px; border-radius: 5px; margin: 10px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h2>${ventaData.emisor_razon_social}</h2>
            <p>Comprobante de Venta</p>
          </div>
          
          <div class="content">
            <p>Estimado(a) <strong>${ventaData.cliente_nombre}</strong>,</p>
            
            <p>Esperamos que se encuentre bien. Adjunto a este correo encontrará el comprobante de su compra:</p>
            
            <div class="highlight">
              <strong>Detalles de la venta:</strong><br>
              Número de venta: <strong>${ventaData.numero_secuencial}</strong><br>
              Fecha: <strong>${new Date(ventaData.fecha_emision).toLocaleDateString('es-ES')}</strong><br>
              Total: <strong>$${ventaData.total.toFixed(2)}</strong>
            </div>
            
            <p>Si tiene alguna pregunta sobre su compra, no dude en contactarnos.</p>
            
            <p>¡Gracias por su preferencia!</p>
          </div>
          
          <div class="footer">
            <p>Este es un mensaje automático, por favor no responda a este correo.</p>
            <p>${ventaData.emisor_razon_social} | RUC: ${ventaData.emisor_ruc}</p>
            <p>${ventaData.emisor_direccion}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Probar configuración de email
   */
  async probarConfiguracion() {
    try {
      await this.setupTransporter();
      return { success: true, message: 'Configuración de email válida' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }
}

export default EmailService;
