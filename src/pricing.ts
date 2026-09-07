import { HttpError } from "./sql";
import {
  isDrinkSize,
  isMilkChoice,
  SIZE_ADJUSTMENT_CENTS,
  type DrinkSize,
  type MilkChoice,
} from "./types";

export const MIN_ORDER_SUBTOTAL_CENTS = 500;

export function assertMinimumSubtotal(subtotalCents: number): void {
  if (subtotalCents < MIN_ORDER_SUBTOTAL_CENTS) {
    throw new HttpError(
      400,
      `order subtotal must be at least ${MIN_ORDER_SUBTOTAL_CENTS} cents`
    );
  }
}

export type MenuItemForPrice = {
  price_cents: number;
  category: string;
};

export function priceOrderLine(
  menuItem: MenuItemForPrice,
  raw: { size?: unknown; milk?: unknown }
): { unitPriceCents: number; size: DrinkSize | null; milk: MilkChoice | null } {
  const category = String(menuItem.category);
  const sizeRaw = raw.size;
  const milkRaw = raw.milk;

  if (category === "food") {
    if (sizeRaw !== undefined && sizeRaw !== null && sizeRaw !== "") {
      throw new HttpError(400, "food items must not include size");
    }
    if (milkRaw !== undefined && milkRaw !== null && milkRaw !== "") {
      throw new HttpError(400, "food items must not include milk");
    }
    return {
      unitPriceCents: Number(menuItem.price_cents),
      size: null,
      milk: null,
    };
  }

  if (category !== "drink") {
    throw new HttpError(400, "unknown menu category");
  }

  let size: DrinkSize = "SMALL";
  if (sizeRaw !== undefined && sizeRaw !== null && sizeRaw !== "") {
    if (typeof sizeRaw !== "string" || !isDrinkSize(sizeRaw)) {
      throw new HttpError(400, "size must be SMALL, MEDIUM, or LARGE");
    }
    size = sizeRaw;
  }

  let milk: MilkChoice | null = null;
  if (milkRaw !== undefined && milkRaw !== null && milkRaw !== "") {
    if (typeof milkRaw !== "string" || !isMilkChoice(milkRaw)) {
      throw new HttpError(400, "milk must be whole, skim, oat, or almond");
    }
    milk = milkRaw;
  }

  const unitPriceCents =
    Number(menuItem.price_cents) + SIZE_ADJUSTMENT_CENTS[size];
  return { unitPriceCents, size, milk };
}
