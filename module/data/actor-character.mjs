import {
  resourceField, attributesSchema, abilitiesSchema,
  saveField, skillSlots, weaponSkillField, defenseSchema, calculateDefense
} from "./helpers.mjs";

const fields = foundry.data.fields;

/**
 * Data model for player characters.
 * Field paths are identical to the pre-2.0 template.json, so existing world
 * data loads without migration.
 */
export class CharacterData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      life: resourceField(10, 10),
      faith: resourceField(5, 5),
      attributes: attributesSchema(),
      abilities: abilitiesSchema(),

      biography: new fields.HTMLField({ required: true, initial: "" }),
      level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      experience: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      class: new fields.StringField({ required: true, initial: "adventurer" }),
      stature: new fields.StringField({ required: true, initial: "commonFolk" }),
      age: new fields.NumberField({ required: true, integer: true, initial: 20 }),
      gender: new fields.StringField({ required: true, initial: "male" }),
      height: new fields.StringField({ required: true, initial: "" }),
      weight: new fields.StringField({ required: true, initial: "" }),

      classData: new fields.SchemaField({
        baseLife: new fields.NumberField({ required: true, integer: true, initial: 10 }),
        lifePerLevel: new fields.NumberField({ required: true, integer: true, initial: 6 }),
        baseFaith: new fields.NumberField({ required: true, integer: true, initial: 5 }),
        faithPerLevel: new fields.NumberField({ required: true, integer: true, initial: 4 })
      }),

      saves: new fields.SchemaField({
        usingMagic: saveField("Using Magic", 21),
        curse: saveField("Curse", 18),
        spell: saveField("Spell", 17),
        disease: saveField("Disease", 16),
        poison: saveField("Poison", 15),
        fumesAcid: saveField("Fumes/Acid", 14),
        magicItem: saveField("Magic Item", 13),
        runeTrap: saveField("Rune Trap", 12),
        death: saveField("Death", 11),
        sin: saveField("Sin", 10),
        fright: saveField("Fright", 9),
        miracle: saveField("Miracle", 8),
        holyItem: saveField("Holy Item", 7)
      }),

      skills: new fields.SchemaField({
        gifts: skillSlots("gift", "Gift", 7),
        talents: skillSlots("talent", "Talent", 7),
        crafts: skillSlots("craft", "Craft", 15)
      }),

      weaponSkills: new fields.SchemaField({
        handToHand: weaponSkillField("Hand To Hand", 2),
        lightArms: weaponSkillField("Light Arms", 1),
        heavyArms: weaponSkillField("Heavy Arms", 1),
        pairedWeapons: weaponSkillField("Paired Weapons", 2),
        missile: weaponSkillField("Missile", 1),
        thrown: weaponSkillField("Thrown", 1),
        kickAttack: weaponSkillField("Kick Attack", 1)
      }),

      defense: defenseSchema(),

      combat: new fields.SchemaField({
        advantageBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        dodgeBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        defendBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        damageBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        halfDefenseFlag: new fields.BooleanField({ required: true, initial: false }),
        initiative: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),

      currency: new fields.SchemaField({
        gold: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        silver: new fields.NumberField({ required: true, integer: true, initial: 0 })
      }),

      sins: new fields.ArrayField(new fields.StringField()),
      phobias: new fields.ArrayField(new fields.StringField())
    };
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.#calculateAbilities();
    this.#calculateSkillMods();
    // Life and Faith maxima are stored values per the rulebook (STR + END +
    // class die at Level 1, plus a rolled die per level), not derived numbers.
    // Clamp current values to the stored maximum.
    if (this.life.value > this.life.max) this.life.value = this.life.max;
    if (this.faith.value > this.faith.max) this.faith.value = this.faith.max;
  }

  /** @override */
  prepareDerivedData() {
    // Requires embedded items, so it runs in derived prep.
    calculateDefense(this, this.parent);
  }

  /** Skill PF totals: mod mirrors the single visible PF box. */
  #calculateSkillMods() {
    for (const group of Object.values(this.skills)) {
      for (const skill of Object.values(group)) {
        skill.mod = skill.value || 0;
      }
    }
  }

  /** Ability proficiency factors, derived from attribute pairs (round up). */
  #calculateAbilities() {
    const attrs = this.attributes;
    const pairs = {
      perception: ["int", "wis"],
      search: ["int", "pat"],
      climb: ["will", "str"],
      jump: ["will", "agi"],
      balance: ["pat", "agi"],
      hide: ["wis", "spd"],
      appeal: ["cha", "vir"]
    };
    for (const [key, [a, b]] of Object.entries(pairs)) {
      const ability = this.abilities[key];
      ability.value = Math.ceil((attrs[a].value + attrs[b].value) / 2);
      ability.mod = ability.value + (ability.bonus || 0);
    }
  }

}
