import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import type { LucideIcon } from '@lucide/angular';
import {
  LucideArrowDown,
  LucideArrowUp,
  LucideDynamicIcon,
  LucideEye,
  LucideEyeOff,
  LucideLogOut,
  LucideUser,
} from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import {
  DashboardService,
  type DashboardData,
  type MetaResumen,
} from '../../services/dashboard.service';
import { iconoCategoria } from '../../utils/categorias';
import { FabMenuComponent } from '../dashboard/fab-menu/fab-menu.component';
import { CrearMetaComponent } from '../dashboard/formularios/crear-meta/crear-meta.component';
import { CrearCuentaComponent } from '../dashboard/formularios/crear-cuenta/crear-cuenta.component';
import { CrearTransaccionComponent } from '../dashboard/formularios/crear-transaccion/crear-transaccion.component';

const COOKIE_PRIVACIDAD = 'mt_dashboard_privacidad';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    RouterLink,
    RouterLinkActive,
    LucideDynamicIcon,
    LucideArrowDown,
    LucideArrowUp,
    LucideEye,
    LucideEyeOff,
    LucideLogOut,
    LucideUser,
    FabMenuComponent,
    CrearMetaComponent,
    CrearCuentaComponent,
    CrearTransaccionComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.css'],
})
export class DashboardComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dashboard = inject(DashboardService);
  private readonly destroy = inject(DestroyRef);

  readonly radioDonut = 84;

  readonly data = signal<DashboardData | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly crearFormulario = signal<'meta' | 'cuenta' | 'transaccion' | null>(null);
  readonly toast = signal('');
  private _toastTemporizador = 0;
  saliendo = false;
  ocultarMontos = false;

  ngOnInit(): void {
    this.ocultarMontos = this.leerPrivacidad();
    this.destroy.onDestroy(() => clearTimeout(this._toastTemporizador));
    this.cargar();
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    const sub = this.dashboard.obtener().subscribe({
      next: (datos) => {
        this.data.set(datos);
        this.cargando.set(false);
      },
      error: () => {
        this.cargando.set(false);
        this.error.set('Ocurrió un error al cargar el panel. Inténtelo de nuevo.');
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  get metaPrincipal(): MetaResumen | null {
    const metas = this.data()?.metas ?? [];
    if (metas.length === 0) return null;
    return metas.reduce(
      (mejor, m) => (m.progreso ?? 0) > (mejor.progreso ?? 0) ? m : mejor,
    );
  }

  get montoMetaPrincipal(): number {
    return this.metaPrincipal?.montoActual ?? 0;
  }

  get progresoMeta(): number {
    return this.metaPrincipal?.progreso ?? 0;
  }

  get circunferenciaDonut(): number {
    return 2 * Math.PI * this.radioDonut;
  }

  get desplazamientoDonut(): number {
    return this.circunferenciaDonut * (1 - this.progresoMeta / 100);
  }

  formatearMonto(valor: number | null | undefined): string {
    if (this.ocultarMontos) return '***';
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(
      valor ?? 0,
    );
  }

  iconoCategoria(categoria: string): LucideIcon {
    return iconoCategoria(categoria);
  }

  puntosSparkline(tendencia: 'sube' | 'baja'): string {
    const total = 12;
    const puntos = Array.from({ length: total }, (_, i) => {
      const x = Math.round((i / (total - 1)) * 100);
      const ruido = Math.sin(i * 1.9) * 5;
      const base = tendencia === 'sube' ? 80 - i * 5.4 : 20 + i * 5.4;
      const y = Math.max(6, Math.min(94, base + ruido));
      return `${x},${Math.round(y)}`;
    });
    return puntos.join(' ');
  }

  alternarPrivacidad(): void {
    this.ocultarMontos = !this.ocultarMontos;
    document.cookie = `${COOKIE_PRIVACIDAD}=${this.ocultarMontos ? '1' : '0'}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
  }

  cerrarSesion(): void {
    if (this.saliendo) return;
    this.saliendo = true;
    const sub = this.auth.logout().subscribe({
      next: () => this.router.navigate(['/']),
      error: () => this.router.navigate(['/']),
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  abrirForm(forma: 'meta' | 'cuenta' | 'transaccion'): void {
    this.crearFormulario.set(forma);
  }

  cerrarForm(): void {
    this.crearFormulario.set(null);
  }

  alCrear(forma: 'meta' | 'cuenta' | 'transaccion'): void {
    this.cerrarForm();
    this.cargar();
    if (forma === 'meta') this.mostrarToast('Meta creada correctamente');
    if (forma === 'cuenta') this.mostrarToast('Cuenta creada correctamente');
    if (forma === 'transaccion') this.mostrarToast('Transacción registrada correctamente');
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