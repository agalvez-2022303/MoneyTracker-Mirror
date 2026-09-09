import { Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import type { LucideIcon } from '@lucide/angular';
import {
  LucideAlertTriangle,
  LucideArrowDown,
  LucideArrowLeft,
  LucideArrowUp,
  LucideDynamicIcon,
  LucideLogOut,
  LucideSearch,
  LucideSlidersHorizontal,
  LucideTrash2,
  LucideX,
} from '@lucide/angular';
import { CATEGORIAS_FILTRO, iconoCategoria } from '../../utils/categorias';
import { AuthService } from '../../services/auth.service';
import {
  TransaccionesService,
  type ResumenTransacciones,
  type TipoTransaccion,
} from '../../services/transacciones.service';
import { UiModalComponent } from '../ui/modal/ui-modal.component';
import type { TransaccionReciente } from '../../services/dashboard.service';

const COOKIE_PRIVACIDAD = 'mt_dashboard_privacidad';
const LIMITE_PAGINA = 50;
const OCULTAR = '***';

interface GrupoDia {
  fecha: string;
  etiqueta: string;
  items: TransaccionReciente[];
  total: number;
}

function mensajeError(err: HttpErrorResponse | unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    if (typeof err.error === 'string' && err.error) return err.error;
    if (err.error?.error) return err.error.error;
  }
  return fallback;
}

@Component({
  selector: 'app-historial',
  standalone: true,
  imports: [
    RouterLink,
    UiModalComponent,
    LucideAlertTriangle,
    LucideArrowDown,
    LucideArrowLeft,
    LucideArrowUp,
    LucideDynamicIcon,
    LucideLogOut,
    LucideSearch,
    LucideSlidersHorizontal,
    LucideTrash2,
    LucideX,
  ],
  templateUrl: './historial.component.html',
  styleUrls: ['./historial.component.css'],
})
export class HistorialComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly transaccionesService = inject(TransaccionesService);
  private readonly destroy = inject(DestroyRef);

  readonly transacciones = signal<TransaccionReciente[]>([]);
  readonly resumen = signal<ResumenTransacciones>({ ingreso: 0, egreso: 0 });
  readonly cargando = signal(true);
  readonly error = signal('');
  readonly hayMas = signal(false);
  readonly saliendo = signal(false);
  readonly ocultarMontos = signal(false);

  readonly filtroTipo = signal<'todos' | TipoTransaccion>('todos');
  readonly categorias = CATEGORIAS_FILTRO;
  readonly categoria = signal('');
  readonly desde = signal('');
  readonly hasta = signal('');
  readonly busqueda = signal('');

  readonly borrarSeleccion = signal<TransaccionReciente | null>(null);
  readonly borrando = signal(false);
  readonly errorBorrar = signal('');

  private _busquedaTimer = 0;
  private _offset = 0;

  ngOnInit(): void {
    this.ocultarMontos.set(this.leerPrivacidad());
    this.destroy.onDestroy(() => clearTimeout(this._busquedaTimer));
    this.cargar();
  }

  get balance(): number {
    const r = this.resumen();
    return r.ingreso - r.egreso;
  }

  get grupoPorDia(): GrupoDia[] {
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(hoy.getDate() - 1);

    const mapa = new Map<string, TransaccionReciente[]>();
    for (const t of this.transacciones()) {
      const fecha = t.createdAt.slice(0, 10);
      const lista = mapa.get(fecha) ?? [];
      lista.push(t);
      mapa.set(fecha, lista);
    }

    return [...mapa.entries()].map(([fecha, items]) => {
      const original = new Date(`${fecha}T00:00:00`);
      let etiqueta = original.toLocaleDateString('es-GT', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      });
      if (fecha === hoy.toISOString().slice(0, 10)) etiqueta = 'Hoy';
      else if (fecha === ayer.toISOString().slice(0, 10)) etiqueta = 'Ayer';

      return {
        fecha,
        etiqueta,
        items,
        total: items.reduce((acc, t) => acc + (t.tipo === 'ingreso' ? t.montoGtq : -t.montoGtq), 0),
      };
    });
  }

  iconoCategoria(categoria: string): LucideIcon {
    return iconoCategoria(categoria);
  }

  formatearMonto(valor: number): string {
    if (this.ocultarMontos()) return OCULTAR;
    return new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' }).format(valor);
  }

  formatearHora(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString('es-GT', { hour: '2-digit', minute: '2-digit' });
  }

  tip(tipo: TipoTransaccion): void {
    if (this.filtroTipo() === tipo) {
      this.filtroTipo.set('todos');
    } else {
      this.filtroTipo.set(tipo);
    }
    this.cargar();
  }

  cambiarCategoria(evento: Event): void {
    this.categoria.set((evento.target as HTMLSelectElement).value);
    this.cargar();
  }

  cambiarFecha(campo: 'desde' | 'hasta', evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value;
    if (campo === 'desde') this.desde.set(valor);
    else this.hasta.set(valor);
    this.cargar();
  }

  onBuscar(evento: Event): void {
    this.busqueda.set((evento.target as HTMLInputElement).value);
    clearTimeout(this._busquedaTimer);
    this._busquedaTimer = window.setTimeout(() => this.cargar(), 400);
  }

  limpiarFiltros(): void {
    this.filtroTipo.set('todos');
    this.categoria.set('');
    this.desde.set('');
    this.hasta.set('');
    this.busqueda.set('');
    this.cargar();
  }

  tieneFiltros(): boolean {
    return (
      this.filtroTipo() !== 'todos' ||
      this.categoria() !== '' ||
      this.desde() !== '' ||
      this.hasta() !== '' ||
      this.busqueda() !== ''
    );
  }

  private filtroTipoServicio(): TipoTransaccion | undefined {
    const tipo = this.filtroTipo();
    return tipo === 'todos' ? undefined : tipo;
  }

  cargar(): void {
    this.cargando.set(true);
    this.error.set('');
    this._offset = 0;

    const sub = this.transaccionesService
      .listar({
        tipo: this.filtroTipoServicio(),
        categoria: this.categoria() || undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        busqueda: this.busqueda().trim() || undefined,
        limit: LIMITE_PAGINA,
        offset: 0,
      })
      .subscribe({
        next: (r) => {
          this.transacciones.set(r.transacciones);
          this.resumen.set(r.resumen);
          this.hayMas.set(r.transacciones.length === LIMITE_PAGINA);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
          this.error.set('Ocurrió un error al cargar el historial. Inténtelo de nuevo.');
        },
      });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  cargarMas(): void {
    if (this.cargando()) return;
    this.cargando.set(true); // mantiene spinner solo en el botón
    this._offset += LIMITE_PAGINA;

    const sub = this.transaccionesService
      .listar({
        tipo: this.filtroTipoServicio(),
        categoria: this.categoria() || undefined,
        desde: this.desde() || undefined,
        hasta: this.hasta() || undefined,
        busqueda: this.busqueda().trim() || undefined,
        limit: LIMITE_PAGINA,
        offset: this._offset,
      })
      .subscribe({
        next: (r) => {
          this.transacciones.update((actual) => [...actual, ...r.transacciones]);
          this.hayMas.set(r.transacciones.length === LIMITE_PAGINA);
          this.cargando.set(false);
        },
        error: () => {
          this.cargando.set(false);
        },
      });
    this.destroy.onDestroy(() => sub.unsubscribe());
  }

  confirmarBorrar(t: TransaccionReciente): void {
    this.borrarSeleccion.set(t);
    this.errorBorrar.set('');
  }

  borrar(): void {
    const seleccion = this.borrarSeleccion();
    if (!seleccion || this.borrando()) return;

    this.borrando.set(true);
    this.errorBorrar.set('');
    const sub = this.transaccionesService.eliminar(seleccion.id).subscribe({
      next: () => {
        this.borrando.set(false);
        this.borrarSeleccion.set(null);
        this.cargar();
      },
      error: (err) => {
        this.borrando.set(false);
        this.errorBorrar.set(mensajeError(err, 'No se pudo eliminar la transacción.'));
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

  private leerPrivacidad(): boolean {
    return (
      document.cookie
        .split('; ')
        .find((c) => c.startsWith(`${COOKIE_PRIVACIDAD}=`))
        ?.split('=')[1] === '1'
    );
  }
}