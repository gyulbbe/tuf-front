import { PICKUP_RADIUS } from "../lib/constants";
import type { World } from "../lib/types";
import { WEAPONS } from "../lib/weapons";
import type { GameState } from "../state/game";
import type { InventoryState } from "../state/inventory";

export function tickPickups(
  world: World,
  inventory: InventoryState,
  game: GameState,
  onPickup: (message: string) => void,
): void {
  const pickupRadiusSquared = PICKUP_RADIUS * PICKUP_RADIUS;

  for (const pickup of world.pickups) {
    if (pickup.taken) {
      continue;
    }

    const dx = pickup.x - world.player.pos.x;
    const dy = pickup.y - world.player.pos.y;

    if (dx * dx + dy * dy > pickupRadiusSquared) {
      continue;
    }

    const weapon = WEAPONS[pickup.type];

    pickup.taken = true;
    inventory.owned.add(pickup.type);

    if (weapon.clipSize !== null && inventory.ammo[pickup.type] <= 0) {
      inventory.ammo[pickup.type] = weapon.clipSize;
    }

    onPickup(`${weapon.name} 획득!`);
  }

  for (const pickup of world.healthPickups) {
    if (pickup.taken || game.playerHp >= game.playerMaxHp) {
      continue;
    }

    const dx = pickup.x - world.player.pos.x;
    const dy = pickup.y - world.player.pos.y;

    if (dx * dx + dy * dy > pickupRadiusSquared) {
      continue;
    }

    pickup.taken = true;
    game.playerHp = Math.min(game.playerMaxHp, game.playerHp + pickup.amount);
    game.hurtFlashUntil = 0;
    onPickup(`체력 +${pickup.amount}`);
  }
}
