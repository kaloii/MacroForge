import {
  DiscountClass,
  CartLinesDiscountsGenerateRunResult,
  RunInput,
  ProductDiscountSelectionStrategy,
} from "../generated/api";

export function cartLinesDiscountsGenerateRun(
  input: RunInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.cart.lines || input.cart.lines.length === 0) {
    return { operations: [] };
  }

  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  const stacks: Record<
    string,
    {
      gear?: { id: string; amount: number };
      meal?: { id: string; amount: number };
      supp?: { id: string; amount: number };
    }
  > = {};

  for (const line of input.cart.lines) {
    const stackId = line.stackId?.value;
    const role = line.stackRole?.value;

    if (!stackId || !role) continue;

    const amount = parseFloat(line.cost.amountPerQuantity.amount) * line.quantity;

    if (!stacks[stackId]) {
      stacks[stackId] = {};
    }

    if (role === 'gear') {
      stacks[stackId].gear = { id: line.id, amount };
    } else if (role === 'meal') {
      stacks[stackId].meal = { id: line.id, amount };
    } else if (role === 'supp') {
      stacks[stackId].supp = { id: line.id, amount };
    }
  }

  const targets: { cartLine: { id: string } }[] = [];
  let appliedDiscountPercentage = 15;

  for (const stackId of Object.keys(stacks)) {
    const stack = stacks[stackId];
    if (stack.gear && stack.meal && stack.supp) {
      const rawTotal = stack.gear.amount + stack.meal.amount + stack.supp.amount;
      appliedDiscountPercentage = rawTotal > 150 ? 20 : 15;

      targets.push({ cartLine: { id: stack.gear.id } });
      targets.push({ cartLine: { id: stack.meal.id } });
      targets.push({ cartLine: { id: stack.supp.id } });
    }
  }

  if (targets.length === 0) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          selectionStrategy: ProductDiscountSelectionStrategy.First,
          candidates: [
            {
              message: "FORGE STACK BUNDLE DISCOUNT",
              targets: targets,
              value: {
                percentage: {
                  value: appliedDiscountPercentage,
                },
              },
            },
          ],
        },
      },
    ],
  };
}