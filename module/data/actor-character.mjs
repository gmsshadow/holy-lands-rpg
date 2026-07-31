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
      phobias: new fields.ArrayField(new fields.StringField()),

      creation: new fields.SchemaField({
        attributesRolled: new fields.BooleanField({ required: true, initial: false })
      })
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

  /**
   * Attribute dice per Stature (Genesis p.53, Step 2). All rolls are GE.
   */
  static STATURE_ATTRIBUTE_DICE = {
    weeFolk:    { int: "3d4", wis: "3d4", pat: "3d4", will: "3d4", mem: "3d4", str: "1d4", agi: "4d4", spd: "3d4", end: "2d4", bty: "4d4", cha: "3d4", vir: "3d4" },
    dwarfolk:   { int: "3d4", wis: "3d4", pat: "2d4", will: "4d4", mem: "3d4", str: "4d4", agi: "3d4", spd: "2d4", end: "4d4", bty: "3d4", cha: "2d4", vir: "3d4" },
    commonFolk: { int: "3d4", wis: "3d4", pat: "3d4", will: "3d4", mem: "3d4", str: "3d4", agi: "3d4", spd: "3d4", end: "3d4", bty: "3d4", cha: "3d4", vir: "3d4" },
    giantFolk:  { int: "3d4", wis: "3d4", pat: "2d4", will: "3d4", mem: "3d4", str: "5d4", agi: "3d4", spd: "2d4", end: "4d4", bty: "2d4", cha: "2d4", vir: "3d4" }
  };

  /** Skill-name patterns for combat point budgets (Steps 7-8, Genesis p.59). */
  static COMBAT_ABILITIES_PATTERN = /combat\s*abilit/i;

  static WS_PATTERNS = {
    handToHand: /hand\s*to\s*hand/i,
    lightArms: /light\s*arms?/i,
    heavyArms: /heavy\s*arms?/i,
    pairedWeapons: /paired\s*weapons?/i,
    missile: /\bmissiles?\b/i,
    thrown: /\bthrown\b/i,
    kickAttack: /kick/i
  };

  /** @override */
  prepareDerivedData() {
    // Requires embedded items, so it runs in derived prep.
    calculateDefense(this, this.parent);
    this.#prepareCombatValidation();
  }

  /**
   * Combat point budgets and rule validation (Genesis Ch6, Steps 7-8):
   * - "Combat Abilities" skill PF = +1s to distribute across ADV/DOD/DEF/DAM,
   *   with the Rule of Halves on the group (p.55).
   * - Each "WS <name>" skill PF = +1s across that Weapon Skill's ATT/CRI/SPC,
   *   with ATT >= CRI and ATT >= SPC.
   * - Having a WS skill grants +1 AtR over the base (2 for Hand to Hand and
   *   Paired Weapons, 1 for the rest).
   * Soft validation only - the Rac may award extra Bonuses (e.g. AGI 12+
   * grants AtR), so nothing is blocked, just flagged.
   */
  #prepareCombatValidation() {
    const cls = this.constructor;

    // Gather every named skill slot with its PF
    const slots = [];
    for (const group of Object.values(this.skills)) {
      for (const skill of Object.values(group)) {
        if (skill.name) slots.push({ name: skill.name, pf: skill.mod || 0 });
      }
    }

    // --- Step 7: Combat Abilities budget + Rule of Halves ---
    const caBudget = slots
      .filter(x => cls.COMBAT_ABILITIES_PATTERN.test(x.name))
      .reduce((sum, x) => sum + x.pf, 0);
    const c = this.combat;
    const caValues = [c.advantageBonus || 0, c.dodgeBonus || 0, c.defendBonus || 0, c.damageBonus || 0];
    const caSpent = caValues.reduce((a, b) => a + b, 0);
    const sorted = [...caValues].sort((a, b) => b - a);
    const halvesViolation = (sorted[0] > 7) && (sorted[1] < Math.ceil(sorted[0] / 2));

    const ca = {
      budget: caBudget,
      spent: caSpent,
      hasSkill: caBudget > 0 || slots.some(x => cls.COMBAT_ABILITIES_PATTERN.test(x.name)),
      over: caSpent > caBudget,
      halvesViolation,
      warnings: []
    };
    if (ca.over) ca.warnings.push(`${caSpent} points spent but only ${caBudget} granted by the Combat Abilities skill`);
    if (!ca.hasSkill && caSpent > 0) ca.warnings.push("No Combat Abilities skill found in Gifts/Talents/Crafts");
    if (halvesViolation) ca.warnings.push(`Rule of Halves: with a +${sorted[0]} Bonus the second highest must be at least +${Math.ceil(sorted[0] / 2)}`);

    // --- Step 8: per-Weapon-Skill budgets, ATT >= CRI/SPC, AtR ---
    const ws = {};
    for (const [key, skill] of Object.entries(this.weaponSkills)) {
      const matches = slots.filter(x => cls.WS_PATTERNS[key]?.test(x.name));
      const budget = matches.reduce((sum, x) => sum + x.pf, 0);
      const hasSkill = matches.length > 0;
      const att = skill.attackBonus || 0;
      const cri = skill.criticalBonus || 0;
      const spc = skill.specialBonus || 0;
      const spent = att + cri + spc;
      const baseAtR = ["handToHand", "pairedWeapons"].includes(key) ? 2 : 1;
      const expectedAtR = baseAtR + (hasSkill ? 1 : 0);

      const v = {
        budget, spent, hasSkill, expectedAtR,
        over: spent > budget,
        criOverAtt: cri > att,
        spcOverAtt: spc > att,
        atrMismatch: (skill.atRMax || 0) !== expectedAtR,
        warnings: []
      };
      if (v.over) v.warnings.push(`${spent} points spent but only ${budget} granted by the ${skill.label} skill`);
      if (v.criOverAtt) v.warnings.push("Critical Bonus cannot exceed the Attack Bonus");
      if (v.spcOverAtt) v.warnings.push("Special Bonus cannot exceed the Attack Bonus");
      if (v.atrMismatch) v.warnings.push(`Expected ${expectedAtR} AtR (${baseAtR} base${hasSkill ? " +1 for having the skill" : ""}; Rac awards such as AGI 12+ may differ)`);
      ws[key] = v;
    }

    this.combatValidation = { ca, ws };
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
