import {
  resourceField, attributesSchema, abilitiesSchema, defenseSchema,
  weaponSkillField, calculateDefense
} from "./helpers.mjs";

const fields = foundry.data.fields;

/**
 * Save DFs by creature category: Christian [non-Christian | demon]
 * (Genesis Ch3, pp.24-27).
 */
export const NPC_SAVE_DFS = {
  usingMagic: { christian: 21, nonChristian: 3, demon: 0 },
  curse: { christian: 18, nonChristian: 18, demon: 15 },
  spell: { christian: 17, nonChristian: 13, demon: 9 },
  disease: { christian: 16, nonChristian: 16, demon: 7 },
  poison: { christian: 15, nonChristian: 15, demon: 15 },
  fumesAcid: { christian: 14, nonChristian: 14, demon: 14 },
  magicItem: { christian: 13, nonChristian: 11, demon: 7 },
  runeTrap: { christian: 12, nonChristian: 12, demon: 12 },
  death: { christian: 11, nonChristian: 10, demon: 9 },
  sin: { christian: 10, nonChristian: 19, demon: 21 },
  fright: { christian: 9, nonChristian: 9, demon: 7 },
  miracle: { christian: 8, nonChristian: 13, demon: 17 },
  holyItem: { christian: 7, nonChristian: 13, demon: 15 }
};

const SAVE_LABELS = {
  usingMagic: "Using Magic",
  curse: "Curse",
  spell: "Spell",
  disease: "Disease",
  poison: "Poison",
  fumesAcid: "Fumes/Acid",
  magicItem: "Magic Item",
  runeTrap: "Rune Trap",
  death: "Death",
  sin: "Sin",
  fright: "Fright",
  miracle: "Miracle",
  holyItem: "Holy Item"
};

/** An NPC save: bonus + optional DF override (DF derives from category). */
function npcSaveField(key) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    dfOverride: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
    label: new fields.StringField({ required: true, initial: SAVE_LABELS[key] })
  });
}

/**
 * Data model for NPCs and Monsters. One type serves both stat-block styles;
 * `npcKind` toggles the monster-only fields on the sheet.
 */
export class NpcData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const saves = {};
    for (const key of Object.keys(NPC_SAVE_DFS)) saves[key] = npcSaveField(key);

    return {
      life: resourceField(10, 10),
      faith: resourceField(5, 5),
      attributes: attributesSchema(),
      abilities: abilitiesSchema(),

      biography: new fields.HTMLField({ required: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      type: new fields.StringField({ required: true, initial: "enemy" }),

      // Stat-block identity
      npcKind: new fields.StringField({ required: true, initial: "human", choices: ["human", "monster"] }),
      category: new fields.StringField({ required: true, initial: "nonChristian", choices: ["christian", "nonChristian", "demon"] }),

      // Monster-block extras
      lifeRange: new fields.StringField({ required: true, initial: "" }),
      size: new fields.StringField({ required: true, initial: "" }),
      exp: new fields.SchemaField({
        value: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
        range: new fields.StringField({ required: true, initial: "" })
      }),
      features: new fields.StringField({ required: true, initial: "" }),

      // CS - Notable Skills and Abilities (name +value pairs)
      skills: new fields.ArrayField(new fields.SchemaField({
        name: new fields.StringField({ required: true, initial: "" }),
        value: new fields.NumberField({ required: true, integer: true, initial: 0 })
      })),

      // WS - full weapon skill block (same shape as characters, so the
      // combat automation works for NPC attacks)
      weaponSkills: new fields.SchemaField({
        handToHand: weaponSkillField("Hand To Hand", 2),
        lightArms: weaponSkillField("Light Arms", 1),
        heavyArms: weaponSkillField("Heavy Arms", 1),
        pairedWeapons: weaponSkillField("Paired Weapons", 2),
        missile: weaponSkillField("Missile", 1),
        thrown: weaponSkillField("Thrown", 1),
        kickAttack: weaponSkillField("Kick Attack", 1)
      }),

      activeWeaponSkill: new fields.StringField({ required: true, initial: "lightArms" }),

      saves: new fields.SchemaField(saves),

      defense: defenseSchema(),

      combat: new fields.SchemaField({
        advantageBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        dodgeBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        defendBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damageBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        halfDefenseFlag: new fields.BooleanField({ required: true, initial: false }),
        attack: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damage: new fields.StringField({ required: true, initial: "1d6" })
      })
    };
  }

  /** @override */
  prepareDerivedData() {
    calculateDefense(this, this.parent);

    // Derive each save's DF from the creature category (p.24 onwards),
    // unless a per-save override has been entered.
    const category = this.category || "nonChristian";
    for (const [key, save] of Object.entries(this.saves)) {
      const table = NPC_SAVE_DFS[key];
      save.df = Number.isFinite(save.dfOverride) && (save.dfOverride !== null)
        ? save.dfOverride
        : (table?.[category] ?? 10);
    }
  }

  /**
   * Notable skills as embedded skill items (drag-dropped from compendia or
   * added custom), sorted alphabetically. Replaces the old free-text
   * ArrayField; that data is migrated to items by a one-time hook.
   */
  get notableSkills() {
    return this.parent.items
      .filter(i => i.type === "skill")
      .sort((a, b) => a.name.localeCompare(b.name));
  }
}
