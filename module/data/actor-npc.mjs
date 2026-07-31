import {
  resourceField, attributesSchema, abilitiesSchema, defenseSchema, calculateDefense
} from "./helpers.mjs";

const fields = foundry.data.fields;

/**
 * Data model for NPCs. Field paths match the pre-2.0 template.json.
 */
export class NpcData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      life: resourceField(10, 10),
      faith: resourceField(5, 5),
      attributes: attributesSchema(),
      abilities: abilitiesSchema(),

      biography: new fields.HTMLField({ required: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      type: new fields.StringField({ required: true, initial: "enemy" }),

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
  }
}
