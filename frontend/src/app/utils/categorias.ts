import type { LucideIcon } from '@lucide/angular';
import {
  LucideCar,
  LucideDroplets,
  LucideGamepad2,
  LucideGraduationCap,
  LucideHeartPulse,
  LucideLandmark,
  LucidePiggyBank,
  LucideShoppingCart,
  LucideShirt,
  LucideUtensils,
  LucideWallet,
  LucideWifi,
  LucideZap,
} from '@lucide/angular';

const ICONOS_CATEGORIA: Record<string, LucideIcon> = {
  comida: LucideShoppingCart,
  alimentacion: LucideShoppingCart,
  'alimentación': LucideShoppingCart,
  supermercado: LucideShoppingCart,
  restaurante: LucideUtensils,
  transporte: LucideCar,
  'transporte publico': LucideCar,
  'transporte público': LucideCar,
  gasolina: LucideCar,
  servicios: LucideZap,
  luz: LucideZap,
  agua: LucideDroplets,
  internet: LucideWifi,
  salud: LucideHeartPulse,
  entretenimiento: LucideGamepad2,
  educacion: LucideGraduationCap,
  'educación': LucideGraduationCap,
  salario: LucideWallet,
  sueldo: LucideWallet,
  nomina: LucideWallet,
  'nómina': LucideWallet,
  renta: LucideLandmark,
  vivienda: LucideLandmark,
  ropa: LucideShirt,
  ahorro: LucidePiggyBank,
};

export const CATEGORIAS_FILTRO: { valor: string; texto: string }[] = [
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

const ICONO_DEFECTO = LucideShoppingCart;

export function iconoCategoria(categoria: string | null | undefined): LucideIcon {
  return ICONOS_CATEGORIA[(categoria ?? '').trim().toLowerCase()] ?? ICONO_DEFECTO;
}