import { Component, DestroyRef, ElementRef, afterNextRender, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import {
  LucideArrowLeft,
  LucideArrowRight,
  LucideCheck,
  LucideEye,
  LucideEyeOff,
} from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import { ThreeDShapesComponent } from '../three-d-shapes/three-d-shapes.component';
import { GOOGLE_CLIENT_ID } from '../../config/google.config';

interface GsiCredentialResponse {
  credential: string;
  select_by: string;
}

interface GsiConfig {
  client_id: string;
  callback: (response: GsiCredentialResponse) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GsiConfig) => void;
          renderButton: (parent: HTMLElement | null, options: Record<string, unknown>) => void;
        };
      };
    };
  }
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    ThreeDShapesComponent,
    LucideArrowLeft,
    LucideArrowRight,
    LucideCheck,
    LucideEye,
    LucideEyeOff,
  ],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css'],
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);

  readonly botonGoogle = viewChild<ElementRef<HTMLDivElement>>('botonGoogle');

  readonly formulario = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  mostrarPassword = false;
  readonly enviando = signal(false);
  readonly error = signal('');

  constructor() {
    afterNextRender(() => this.inicializarGoogle());
  }

  private inicializarGoogle(): void {
    const destruido = { valor: false };
    this.destroy.onDestroy(() => {
      destruido.valor = true;
    });

    const esperarGoogle = (intentos: number) => {
      if (destruido.valor) return;
      const gsi = window.google?.accounts?.id;
      if (!gsi) {
        if (intentos > 0) setTimeout(() => esperarGoogle(intentos - 1), 200);
        return;
      }
      gsi.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response) => this.manejarGoogle(response),
      });

      const contenedor = this.botonGoogle()?.nativeElement;
      const ancho = Math.max(200, Math.min(contenedor?.offsetWidth ?? 360, 400));

      gsi.renderButton(contenedor ?? null, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        width: ancho,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
      });
    };
    esperarGoogle(50);
  }

  private manejarGoogle(response: GsiCredentialResponse): void {
    if (this.enviando()) return;
    this.enviando.set(true);
    this.error.set('');

    const sub = this.auth.loginConGoogle(response.credential).subscribe({
      next: () => {
        this.enviando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (typeof err.error === 'string' && err.error) {
          this.error.set(err.error);
        } else if (err.error?.error) {
          this.error.set(err.error.error);
        } else {
          this.error.set('No se pudo iniciar sesión con Google.');
        }
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  enviar(): void {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }
    this.enviando.set(true);
    this.error.set('');
    const { email, password } = this.formulario.getRawValue();

    const sub = this.auth.login(email, password).subscribe({
      next: () => {
        this.enviando.set(false);
        this.router.navigate(['/dashboard']);
      },
      error: (err: HttpErrorResponse) => {
        this.enviando.set(false);
        if (err.status === 401) {
          this.error.set('Correo o contraseña incorrectos.');
        } else if (typeof err.error === 'string' && err.error) {
          this.error.set(err.error);
        } else if (err.error?.error) {
          this.error.set(err.error.error);
        } else {
          this.error.set('No se pudo conectar con el servidor.');
        }
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }
}