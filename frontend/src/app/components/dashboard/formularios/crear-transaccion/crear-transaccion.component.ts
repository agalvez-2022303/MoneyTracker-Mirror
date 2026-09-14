import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { UiModalComponent } from '../../../ui/modal/ui-modal.component';
import { UiInputComponent } from '../../../ui/campo/ui-input.component';
import { UiSelectComponent } from '../../../ui/campo/ui-select.component';
import { UiAreaComponent } from '../../../ui/campo/ui-area.component';
import { TransaccionesService, type TipoTransaccion } from '../../../../services/transacciones.service';
import type { CuentaResumen, MetaResumen } from '../../../../services/dashboard.service';
import { errorDe, limpiarTexto, mayorQueCero } from '../errores';

interface Moneda {
  codigo: string;
  texto: string;
  tasa: number;
}

@Component({
  selector: 'app-crear-transaccion',
  standalone: true,
  imports: [ReactiveFormsModule, UiModalComponent, UiInputComponent, UiSelectComponent, UiAreaComponent],
  templateUrl: './crear-transaccion.component.html',
})
export class CrearTransaccionComponent {
  private readonly fb = inject(FormBuilder);
  private readonly transacciones = inject(TransaccionesService);

  readonly cuentas = input<CuentaResumen[]>([]);
  readonly metas = input<MetaResumen[]>([]);

  readonly registrada = output<void>();
  readonly cerrado = output<void>();

  readonly monedas: Moneda[] = [
    { codigo: 'GTQ', texto: 'Quetzal (GTQ)', tasa: 1 },
    { codigo: 'USD', texto: 'Dólar (USD)', tasa: 7.75 },
    { codigo: 'EUR', texto: 'Euro (EUR)', tasa: 8.55 },
    { codigo: 'MXN', texto: 'Peso mexicano (MXN)', tasa: 0.42 },
    { codigo: 'BTC', texto: 'Bitcoin (BTC)', tasa: 495000 },
  ];

  readonly categorias: { valor: string; texto: string }[] = [
    { valor: 'comida', texto: 'Comida' },
    { valor: 'transporte', texto: 'Transporte' },
    { valor: 'servicios', texto: 'Servicios' },
    { valor: 'salud', texto: 'Salud' },
    { valor: 'entretenimiento', texto: 'Entretenimiento' },
    { valor: 'educacion', texto: 'Educación' },
    { valor: 'ropa', texto: 'Ropa' },
    { valor: 'sueldo', texto: 'Ingreso fijo' },
    { valor: 'ahorro', texto: 'Ahorro' },
    { valor: 'otro', texto: 'Otro' },
  ];

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    tipo: ['ingreso' as TipoTransaccion],
    destino: ['', [Validators.required]],
    cantidad: ['', [Validators.required, mayorQueCero]],
    moneda: ['GTQ'],
    categoria: ['otro'],
    categoriaOtro: [''],
    descripcion: [''],
  });

  readonly enviando = signal(false);
  readonly errorGlobal = signal('');

  readonly formateadorQt = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });

  ngOnInit(): void {
    if (this.cuentas().length > 0) {
      this.formulario.controls.destino.setValue(`c${this.cuentas()[0].id}`);
    } else if (this.metas().length > 0) {
      this.formulario.controls.destino.setValue(`m${this.metas()[0].id}`);
    }

    this.formulario.controls.categoria.valueChanges.subscribe((v) => {
      const otro = this.formulario.controls.categoriaOtro;
      if (v === 'otro') {
        otro.enable();
      } else {
        otro.disable();
      }
      otro.clearValidators();
      otro.updateValueAndValidity();
    });
    this.formulario.controls.categoria.updateValueAndValidity();
  }

  err(nombre: string): string {
    return errorDe(this.formulario, nombre);
  }

  setTipo(tipo: TipoTransaccion): void {
    this.formulario.controls.tipo.setValue(tipo);
  }

  tasaActual(): number {
    const codigo = this.formulario.getRawValue().moneda;
    return this.monedas.find((m) => m.codigo === codigo)?.tasa ?? 1;
  }

  previewQt(): number | null {
    const v = this.formulario.getRawValue();
    if (v.moneda === 'GTQ') return null;
    const n = Number(v.cantidad);
    if (!Number.isFinite(n) || n <= 0) return null;
    return Math.round(n * this.tasaActual() * 100) / 100;
  }

  textoPreviewQt(): string {
    const v = this.previewQt();
    return v === null ? '' : this.formateadorQt.format(v);
  }

  cerrar(): void {
    if (!this.enviando()) this.cerrado.emit();
  }

  avisoFondos(): string | null {
    const v = this.formulario.getRawValue();
    if (v.tipo !== 'egreso' || !v.destino.startsWith('c')) return null;

    const montoGtq = Math.round(Number(v.cantidad) * this.tasaActual() * 100) / 100;
    const cuenta = this.cuentas().find((c) => c.id === Number(v.destino.slice(1)));
    if (!cuenta || montoGtq <= cuenta.montoActual) return null;

    const q = (n: number) => `Q${n.toFixed(2)}`;
    return (
      `No tan rápido velocista: querés gastar ${q(montoGtq)} pero tu cuenta "${cuenta.nombre}" solo tiene ${q(cuenta.montoActual)}. ` +
      `Revisá si estás colocando bien la cantidad o reconsiderá la compra antes de quedar en banca rota.`
    );
  }

  enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;

    const aviso = this.avisoFondos();
    if (aviso) {
      this.errorGlobal.set(aviso);
      return;
    }

    this.enviando.set(true);
    this.errorGlobal.set('');

    const v = this.formulario.getRawValue();
    const esCuenta = v.destino.startsWith('c');
    const destinoId = Number(v.destino.slice(1));

    this.transacciones
      .crear({
        nombre: v.nombre.trim(),
        tipo: v.tipo,
        monto_original: Number(v.cantidad),
        ...(esCuenta ? { cuenta_id: destinoId } : { meta_id: destinoId }),
        moneda_original: v.moneda,
        tasa_cambio_usada: this.tasaActual(),
        categoria: v.categoria === 'otro' ? (v.categoriaOtro.trim() || 'otro') : v.categoria,
        descripcion: limpiarTexto(v.descripcion),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.registrada.emit();
        },
        error: (err: HttpErrorResponse) => {
          this.enviando.set(false);
          const mensaje = typeof err.error === 'string' ? err.error : err.error?.error;
          this.errorGlobal.set(mensaje || 'No se pudo registrar la transacción. Inténtelo de nuevo.');
        },
      });
  }
}