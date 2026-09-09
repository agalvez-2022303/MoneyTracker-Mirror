import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { AuthService, UsuarioSesion } from './auth.service';

export interface DatosExportados {
  usuario: UsuarioSesion;
  cuentas: unknown[];
  metas: unknown[];
  transacciones: unknown[];
}

@Injectable({ providedIn: 'root' })
export class ConfiguracionService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);

  obtenerPerfil(): Observable<UsuarioSesion> {
    return this.http.get<{ usuario: UsuarioSesion }>('/api/usuarios/me').pipe(
      map((r) => r.usuario),
      tap((usuario) => this.auth.usuario.set(usuario))
    );
  }

  guardarNombre(nombre: string | null): Observable<UsuarioSesion> {
    return this.http.put<{ usuario: UsuarioSesion }>('/api/usuarios/me', { nombre }).pipe(
      map((r) => r.usuario),
      tap((usuario) => this.auth.usuario.set(usuario))
    );
  }

  cambiarPassword(passwordActual: string | undefined, nuevaPassword: string): Observable<void> {
    return this.http.post<void>('/api/usuarios/me/cambiar-password', {
      passwordActual,
      nuevaPassword,
    });
  }

  cerrarTodasSesiones(): Observable<void> {
    return this.http.post<{ ok: true }>('/api/auth/sesiones/cerrar', {}).pipe(
      map(() => undefined),
      tap(() => this.auth.usuario.set(null))
    );
  }

  exportarDatos(): Observable<DatosExportados> {
    return this.http.get<DatosExportados>('/api/usuarios/me/datos');
  }

  eliminarCuenta(): Observable<void> {
    const id = this.auth.usuario()?.id as number;
    return this.http.delete<void>(`/api/usuarios/${id}`).pipe(
      tap(() => this.auth.usuario.set(null))
    );
  }
}