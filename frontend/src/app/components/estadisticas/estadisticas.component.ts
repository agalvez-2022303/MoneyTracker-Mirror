import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import {
  LucideArrowDown,
  LucideLogOut,
  LucidePencil,
  LucideTarget,
  LucideWallet,
} from '@lucide/angular';
import { AuthService } from '../../services/auth.service';
import {
  DashboardService,
  type CuentaResumen,
  type DashboardData,
} from '../../services/dashboard.service';
import { TopNavComponent } from '../top-nav/top-nav.component';
import { EditarCuentaComponent } from './editar-cuenta/editar-cuenta.component';

const COOKIE_PRIVACIDAD = 'mt_dashboard_privacidad';
const COLORES_DONUT = [
  '#22E27A',
  '#3B82F6',
  '#A78BFA',
  '#F59E0B',
  '#14B8A6',
  '#EC4899',
  '#F97316',
  '#06B6D4',
  '#8B5CF6',
  '#E11D48',
];

interface SegmentoDonut {
  id: number;
  nombre: string;
  valor: number;
  pct: number;
  color: string;
  dasharray: string;
  dashoffset: number;
  detalle: string;
}

interface EntradaDonut {
  id: number;
  nombre: string;
  valor: number;
  detalle: string;
}

function construirSegmentos(entradas: EntradaDonut[]): SegmentoDonut[] {
  const base = Math.max(
    entradas.reduce((acum, e) => acum + Math.max(e.valor, 0), 0),
    0.000001,
  );
  const muchos = entradas.filter((e) => e.valor > 0).length > 1;
  let acumulado = 0;

  return entradas.map((e) => {
    const pct = e.valor > 0 ? (e.valor / base) * 100 : 0;
    const visible = pct > 0 ? Math.max(pct, 0.6) : 0;
    const separacion = pct > 0 && muchos ? 1.1 : 0;
    return {
      id: e.id,
      nombre: e.nombre,
      valor: e.valor,
      pct,
      color: COLORES_DONUT[entradas.indexOf(e) % COLORES_DONUT.length],
      dasharray:
        pct > 0 ? `${Math.max(visible - separacion, 0.05)} ${100 - visible + separacion}` : '0 100',
      dashoffset: -acumulado,
      detalle: e.detalle,
    };
  });
}

@Component({
  selector: 'app-estadisticas',
  standalone: true,
  imports: [
    RouterLink,
    TopNavComponent,
    EditarCuentaComponent,
    LucideArrowDown,
    LucideLogOut,
    LucidePencil,
    LucideTarget,
    LucideWallet,
  ],
  templateUrl: './estadisticas.component.html',
  styleUrls: ['./estadisticas.component.css'],
})
export class EstadisticasComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dashboard = inject(DashboardService);
  private readonly destroy = inject(DestroyRef);

  readonly data = signal<DashboardData | null>(null);
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly saliendo = signal(false);

  readonly seleccionCuenta = signal<SegmentoDonut | null>(null);
  readonly seleccionMeta = signal<SegmentoDonut | null>(null);
  readonly cuentaEnEdicion = signal<CuentaResumen | null>(null);
  readonly toast = signal('');
  private _toastTemporizador = 0;

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
        this.error.set('Ocurrió un error al cargar las estadísticas. Inténtelo de nuevo.');
      },
    });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  get balance(): number {
    const d = this.data();
    return d ? d.ingresoMes - d.gastoMes : 0;
  }

  get cuentas(): number {
    return (this.data()?.cuentas ?? []).length;
  }

  get metas(): number {
    return (this.data()?.metas ?? []).length;
  }

  get segmentosCuentas(): SegmentoDonut[] {
    const cuentas = this.data()?.cuentas ?? [];
    return construirSegmentos(
      cuentas.map((c) => ({ id: c.id, nombre: c.nombre, valor: c.montoActual, detalle: c.tipo })),
    );
  }

  get totalCuentas(): number {
    return this.segmentosCuentas.reduce((acum, s) => acum + s.valor, 0);
  }

  get segmentosMetas(): SegmentoDonut[] {
    const metas = this.data()?.metas ?? [];
    return construirSegmentos(
      metas.map((m) => ({
        id: m.id,
        nombre: m.nombre,
        valor: m.montoActual,
        detalle: `de ${this.formatearMonto(m.cantidadObjetivo)}`,
      })),
    );
  }

  get totalAhorrado(): number {
    return this.segmentosMetas.reduce((acum, s) => acum + s.valor, 0);
  }

  redondear(valor: number): number {
    return Math.round(valor);
  }

  formatearMonto(valor: number | null | undefined): string {
    if (this.ocultarMontos) return '***';
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(
      valor ?? 0,
    );
  }

  alPasarCuenta(segmento: SegmentoDonut): void {
    this.seleccionCuenta.set(segmento);
  }

  alSalirCuenta(): void {
    this.seleccionCuenta.set(null);
  }

  alPasarMeta(segmento: SegmentoDonut): void {
    this.seleccionMeta.set(segmento);
  }

  alSalirMeta(): void {
    this.seleccionMeta.set(null);
  }

  abrirEdicion(id: number): void {
    const cuenta = (this.data()?.cuentas ?? []).find((c) => c.id === id);
    if (cuenta) this.cuentaEnEdicion.set(cuenta);
  }

  cerrarEdicion(): void {
    this.cuentaEnEdicion.set(null);
  }

  alEditar(): void {
    this.cerrarEdicion();
    this.cargar();
    this.mostrarToast('Cuenta actualizada correctamente');
  }

  private mostrarToast(mensaje: string): void {
    clearTimeout(this._toastTemporizador);
    this.toast.set(mensaje);
    this._toastTemporizador = window.setTimeout(() => this.toast.set(''), 2600);
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

  private leerPrivacidad(): boolean {
    return (
      document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${COOKIE_PRIVACIDAD}=`))
        ?.split('=')[1] === '1'
    );
  }
}