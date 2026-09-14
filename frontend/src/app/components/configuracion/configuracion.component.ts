import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LucideAlertTriangle,
  LucideCheck,
  LucideDownload,
  LucideLock,
  LucideLogOut,
  LucideTrash2,
} from '@lucide/angular';
import { AuthService, UsuarioSesion } from '../../services/auth.service';
import { ConfiguracionService } from '../../services/configuracion.service';
import { UiModalComponent } from '../ui/modal/ui-modal.component';
import { TopNavComponent } from '../top-nav/top-nav.component';

const COOKIE_PRIVACIDAD = 'mt_dashboard_privacidad';

function mensajeError(err: HttpErrorResponse | unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error) return err.error;
    if (err.error?.error) return err.error.error;
  }
  return fallback;
}

@Component({
  selector: 'app-configuracion',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    UiModalComponent,
    TopNavComponent,
    LucideAlertTriangle,
    LucideCheck,
    LucideDownload,
    LucideLock,
    LucideLogOut,
    LucideTrash2,
  ],
  templateUrl: './configuracion.component.html',
  styleUrls: ['./configuracion.component.css'],
})
export class ConfiguracionComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly config = inject(ConfiguracionService);
  private readonly fb = inject(FormBuilder);
  private readonly destroy = inject(DestroyRef);

  readonly perfil = signal<UsuarioSesion | null>(null);
  readonly cargando = signal(true);
  readonly saliendo = signal(false);

  readonly guardarNombre = signal(false);
  readonly cambiandoPassword = signal(false);
  readonly cerrandoSesiones = signal(false);
  readonly exportando = signal(false);
  readonly borrandoCuenta = signal(false);
  readonly borrarConfirmado = signal(false);

  readonly ocultarMontos = signal(false);
  readonly confirmarCierreSesiones = signal(false);
  readonly modalBorrar = signal(false);

  readonly toast = signal('');
  readonly errorPerfil = signal('');
  readonly errorPassword = signal('');
  readonly errorCierre = signal('');
  readonly errorBorrar = signal('');

  readonly formularioNombre = this.fb.nonNullable.group({
    nombre: ['', [Validators.maxLength(60)]],
  });

  readonly formularioPassword = this.fb.nonNullable.group(
    {
      passwordActual: [''],
      nuevaPassword: ['', [Validators.required, Validators.minLength(6)]],
      confirmarPassword: ['', [Validators.required]],
    },
    { validators: (g) => (g.value.nuevaPassword !== g.value.confirmarPassword ? { noCoinciden: true } : null) },
  );

  private _toastTemporizador = 0;

  ngOnInit(): void {
    this.ocultarMontos.set(this.leerPrivacidad());
    this.destroy.onDestroy(() => clearTimeout(this._toastTemporizador));

    const sub = this.config.obtenerPerfil().subscribe({
      next: (usuario) => {
        this.perfil.set(usuario);
        this.formularioNombre.controls.nombre.setValue(usuario.nombre ?? '');
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.mostrarToast(mensajeError(err, 'No se pudo cargar el perfil.'));
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  get inicial(): string {
    const nombre = this.perfil()?.nombre?.trim();
    if (nombre) return nombre.charAt(0).toUpperCase();
    return (this.perfil()?.email ?? '?').charAt(0).toUpperCase();
  }

  get email(): string {
    return this.perfil()?.email ?? '';
  }

  get rol(): string {
    return this.perfil()?.rol === 'admin' ? 'Administrador' : 'Cliente';
  }

  get fechaRegistro(): string {
    const created = this.perfil()?.createdAt;
    if (!created) return '—';
    return new Date(created).toLocaleDateString('es-GT', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  guardarNombreForm(): void {
    if (this.guardarNombre()) return;
    const nombre = this.formularioNombre.getRawValue().nombre.trim();
    if (nombre.length > 60) {
      this.errorPerfil.set('El nombre no puede exceder 60 caracteres.');
      return;
    }

    this.guardarNombre.set(true);
    this.errorPerfil.set('');
    const sub = this.config.guardarNombre(nombre.length > 0 ? nombre : null).subscribe({
      next: () => {
        this.guardarNombre.set(false);
        this.mostrarToast('Nombre actualizado.');
      },
      error: (err) => {
        this.guardarNombre.set(false);
        this.errorPerfil.set(mensajeError(err, 'No se pudo guardar el nombre.'));
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  cambiarPassword(): void {
    if (this.cambiandoPassword()) return;
    const { passwordActual, nuevaPassword } = this.formularioPassword.getRawValue();

    this.cambiandoPassword.set(true);
    this.errorPassword.set('');
    const sub = this.config
      .cambiarPassword(passwordActual.length > 0 ? passwordActual : undefined, nuevaPassword)
      .subscribe({
        next: () => {
          this.cambiandoPassword.set(false);
          this.formularioPassword.reset();
          this.mostrarToast('Contraseña actualizada.');
        },
        error: (err) => {
          this.cambiandoPassword.set(false);
          this.errorPassword.set(mensajeError(err, 'No se pudo cambiar la contraseña.'));
        },
      });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  alternarPrivacidad(): void {
    const valor = !this.ocultarMontos();
    this.ocultarMontos.set(valor);
    document.cookie = `${COOKIE_PRIVACIDAD}=${valor ? '1' : '0'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  cerrarSesiones(): void {
    if (this.cerrandoSesiones()) return;
    this.cerrandoSesiones.set(true);
    this.errorCierre.set('');
    const sub = this.config.cerrarTodasSesiones().subscribe({
      next: () => {
        this.cerrandoSesiones.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.cerrandoSesiones.set(false);
        this.errorCierre.set(mensajeError(err, 'No se pudieron cerrar las sesiones.'));
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  exportar(): void {
    if (this.exportando()) return;
    this.exportando.set(true);
    const sub = this.config.exportarDatos().subscribe({
      next: (datos) => {
        this.exportando.set(false);
        const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `moneytracker-datos-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.mostrarToast('Datos exportados.');
      },
      error: (err) => {
        this.exportando.set(false);
        this.mostrarToast(mensajeError(err, 'No se pudo exportar los datos.'));
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  borrarCuenta(): void {
    if (this.borrandoCuenta()) return;
    this.borrandoCuenta.set(true);
    this.errorBorrar.set('');
    const sub = this.config.eliminarCuenta().subscribe({
      next: () => {
        this.borrandoCuenta.set(false);
        this.modalBorrar.set(false);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.borrandoCuenta.set(false);
        this.errorBorrar.set(mensajeError(err, 'No se pudo eliminar la cuenta.'));
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  cerrarSesion(): void {
    if (this.saliendo()) return;
    this.saliendo.set(true);
    const sub = this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  private mostrarToast(mensaje: string): void {
    clearTimeout(this._toastTemporizador);
    this.toast.set(mensaje);
    this._toastTemporizador = window.setTimeout(() => this.toast.set(''), 2600);
  }

  private leerPrivacidad(): boolean {
    return (
      document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${COOKIE_PRIVACIDAD}=`))
        ?.split('=')[1] === '1'
    );
  }
}