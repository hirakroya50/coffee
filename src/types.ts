export type OrderStatus =
  | "PENDING"
  | "PREPARING"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY"],
  READY: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isOrderStatus(value: string): value is OrderStatus {
  return Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, value);
}

export const DRINK_SIZES = ["SMALL", "MEDIUM", "LARGE"] as const;
export type DrinkSize = (typeof DRINK_SIZES)[number];

export const SIZE_ADJUSTMENT_CENTS: Record<DrinkSize, number> = {
  SMALL: 0,
  MEDIUM: 50,
  LARGE: 100,
};

export const MILK_CHOICES = ["whole", "skim", "oat", "almond"] as const;
export type MilkChoice = (typeof MILK_CHOICES)[number];

export function isDrinkSize(value: string): value is DrinkSize {
  return (DRINK_SIZES as readonly string[]).includes(value);
}

export function isMilkChoice(value: string): value is MilkChoice {
  return (MILK_CHOICES as readonly string[]).includes(value);
}
