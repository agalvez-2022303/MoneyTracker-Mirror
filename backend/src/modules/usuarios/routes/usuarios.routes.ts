import { Router } from 'express';
import * as usuariosController from '../controllers/usuarios.controller';
import { requireAuth } from '../../../middleware/auth.middleware';

const router = Router();

router.get('/', requireAuth, usuariosController.listar);
router.get('/me', requireAuth, usuariosController.obtenerPerfil);
router.get('/me/datos', requireAuth, usuariosController.exportarDatos);
router.put('/me', requireAuth, usuariosController.actualizarPerfil);
router.post('/me/cambiar-password', requireAuth, usuariosController.cambiarPassword);
router.get('/:id', requireAuth, usuariosController.obtenerPorId);
router.post('/', requireAuth, usuariosController.crear);
router.put('/:id', requireAuth, usuariosController.actualizar);
router.delete('/:id', requireAuth, usuariosController.eliminar);

export default router;