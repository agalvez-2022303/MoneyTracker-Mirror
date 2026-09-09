import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs';

export interface UsuarioSesion {
  id: number;
  email: string;
  rol: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly usuario = signal<UsuarioSesion | null>(null);

  constructor(private http: HttpClient) {}

  login(email: string, password: string): Observable<UsuarioSesion> {
    return this.http
      .post<{ usuario: UsuarioSesion }>('/api/auth/login', { email, password })
      .pipe(
        map((r) => {
          this.usuario.set(r.usuario);
          return r.usuario;
        })
      );
  }

  loginConGoogle(idToken: string): Observable<UsuarioSesion> {
    return this.http
      .post<{ usuario: UsuarioSesion }>('/api/auth/google', { idToken })
      .pipe(
        map((r) => {
          this.usuario.set(r.usuario);
          return r.usuario;
        })
      );
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', {}).pipe(map(() => this.usuario.set(null)));
  }

  verificarSesion(): Observable<boolean> {
    return this.http.get<{ dashboard: unknown }>('/api/dashboard').pipe(
      map(() => true),
      catchError(() => of(false))
    );
  }
}