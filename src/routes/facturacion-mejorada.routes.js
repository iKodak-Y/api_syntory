/**
 * Rutas para facturación electrónica mejorada
 */

import { Router } from 'express';
import {
  emitirFacturaElectronica,
  consultarEstadoFacturaSRI,
  obtenerConfiguracionAmbiente,
  cambiarAmbienteFacturacion,
  listarFacturasElectronicas
} from '../controllers/facturacion-mejorada.controllers.js';

const router = Router();

/**
 * @route POST /api/facturacion/emitir
 * @desc Emite una factura electrónica completa
 */
router.post('/emitir', emitirFacturaElectronica);

/**
 * @route GET /api/facturacion/consultar/:clave_acceso
 * @desc Consulta el estado de una factura en el SRI
 */
router.get('/consultar/:clave_acceso', consultarEstadoFacturaSRI);

/**
 * @route GET /api/facturacion/ambiente
 * @desc Obtiene la configuración actual del ambiente SRI
 */
router.get('/ambiente', obtenerConfiguracionAmbiente);

/**
 * @route POST /api/facturacion/ambiente
 * @desc Cambia el ambiente SRI (pruebas/producción)
 */
router.post('/ambiente', cambiarAmbienteFacturacion);

/**
 * @route GET /api/facturacion/facturas
 * @desc Lista las facturas electrónicas con filtros
 */
router.get('/facturas', listarFacturasElectronicas);

export default router;
