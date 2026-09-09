import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import type { TransaccionReciente } from './dashboard.service';

export type TipoTransaccion = 'ingreso' | 'egreso';

export interface CrearTransaccionDatos {
  nombre: string;
  tipo: TipoTransaccion;
  monto_original: number;
  cuenta_id?: number;
  meta_id?: number;
  moneda_original?: string;
  tasa_cambio_usada?: number;
  categoria: string;
  descripcion: string | null;
}

export interface ListarTransaccionesFiltro {
  tipo?: TipoTransaccion;
  categoria?: string;
  desde?: string;
  hasta?: string;
  busqueda?: string;
  limit?: number;
  offset?: number;
}

export interface ResumenTransacciones {
  ingreso: number;
  egreso: number;
}

export interface ResultadoListar {
  transacciones: TransaccionReciente[];
  resumen: ResumenTransacciones;
}

@Injectable({ providedIn: 'root' })
export class TransaccionesService {
  private readonly http = inject(HttpClient);

  crear(datos: CrearTransaccionDatos): Observable<TransaccionReciente> {
    return this.http
      .post<{ transaccion: TransaccionReciente }>('/api/transacciones', datos)
      .pipe(map((r) => r.transaccion));
  }

  listar(filtro: ListarTransaccionesFiltro = {}): Observable<ResultadoListar> {
    let params = new HttpParams()
      .set('limit', filtro.limit ?? 50)
      .set('offset', filtro.offset ?? 0);
    if (filtro.tipo) params = params.set('tipo', filtro.tipo);
    if (filtro.categoria) params = params.set('categoria', filtro.categoria);
    if (filtro.desde) params = params.set('desde', filtro.desde);
    if (filtro.hasta) params = params.set('hasta', filtro.hasta);
    if (filtro.busqueda) params = params.set('busqueda', filtro.busqueda);

    return this.http.get<ResultadoListar>('/api/transacciones', { params });
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`/api/transacciones/${id}`);
  }
}