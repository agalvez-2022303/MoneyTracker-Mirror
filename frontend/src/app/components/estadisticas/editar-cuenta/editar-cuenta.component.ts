import { Component, OnInit, inject, input, output, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import type { LucideIcon } from '@lucide/angular';
import {
  LucideBanknote,
  LucideBitcoin,
  LucideCircleEllipsis,
  LucideCreditCard,
  LucideDynamicIcon,
} from '@lucide/angular';
import { UiModalComponent } from '../../ui/modal/ui-modal.component';
import { UiInputComponent } from '../../ui/campo/ui-input.component';
import { UiAreaComponent } from '../../ui/campo/ui-area.component';
import { CuentasService, type TipoCuenta } from '../../../services/cuentas.service';
import type { CuentaResumen } from '../../../services/dashboard.service';
import { aNumeroOpcional, errorDe, limpiarTexto, noNegativo } from '../../dashboard/formularios/errores';

const TIPOS_VALIDOS: readonly TipoCuenta[] = ['efectivo', 'tarjeta', 'cripto', 'otro'];

interface OpcionTipo {
  valor: TipoCuenta;
  texto: string;
  icono: LucideIcon;
}

@Component({
  selector: 'app-editar-cuenta',
  standalone: true,
  imports: [ReactiveFormsModule, UiModalComponent, UiInputComponent, UiAreaComponent, LucideDynamicIcon],
  templateUrl: './editar-cuenta.component.html',
})
export class EditarCuentaComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly cuentas = inject(CuentasService);

  readonly cuenta = input.required<CuentaResumen>();
  readonly guardada = output<void>();
  readonly cerrado = output<void>();

  readonly formulario = this.fb.nonNullable.group({
    nombre: ['', [Validators.required]],
    tipo: ['efectivo' as TipoCuenta],
    descripcion: [''],
    monto: ['', [Validators.required, noNegativo]],
  });

  readonly enviando = signal(false);
  readonly errorGlobal = signal('');

  readonly tipos: OpcionTipo[] = [
    { valor: 'efectivo', texto: 'Efectivo', icono: LucideBanknote },
    { valor: 'tarjeta', texto: 'Tarjeta', icono: LucideCreditCard },
    { valor: 'cripto', texto: 'Cripto', icono: LucideBitcoin },
    { valor: 'otro', texto: 'Otro', icono: LucideCircleEllipsis },
  ];

  ngOnInit(): void {
    const c = this.cuenta();
    const tipo = TIPOS_VALIDOS.includes(c.tipo as TipoCuenta) ? (c.tipo as TipoCuenta) : 'otro';
    this.formulario.patchValue({
      nombre: c.nombre,
      tipo,
      descripcion: c.descripcion ?? '',
      monto: String(c.montoActual),
    }, { emitEvent: false });
  }

  err(nombre: string): string {
    return errorDe(this.formulario, nombre);
  }

  setTipo(valor: TipoCuenta): void {
    this.formulario.controls.tipo.setValue(valor);
    this.formulario.controls.tipo.markAsTouched();
  }

  cerrar(): void {
    if (!this.enviando()) this.cerrado.emit();
  }

  enviar(): void {
    this.formulario.markAllAsTouched();
    if (this.formulario.invalid) return;
    this.enviando.set(true);
    this.errorGlobal.set('');

    const v = this.formulario.getRawValue();

    this.cuentas
      .actualizar(this.cuenta().id, {
        nombre: v.nombre.trim(),
        tipo: v.tipo,
        descripcion: limpiarTexto(v.descripcion),
        monto_actual: aNumeroOpcional(v.monto),
      })
      .subscribe({
        next: () => {
          this.enviando.set(false);
          this.guardada.emit();
        },
        error: () => {
          this.enviando.set(false);
          this.errorGlobal.set('No se pudo actualizar la cuenta. Inténtelo de nuevo.');
        },
      });
  }
}