import {
  resourceField, attributesSchema, abilitiesSchema,
  saveField, weaponSkillField, defenseSchema, calculateDefense
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
      nativeLand: new fields.StringField({ required: true, initial: "" }),
      languageGroup: new fields.StringField({ required: true, initial: "" }),

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
        attributesRolled: new fields.BooleanField({ required: true, initial: false }),
        saveBonusChosen: new fields.BooleanField({ required: true, initial: false }),
        startingRolled: new fields.BooleanField({ required: true, initial: false }),
        lifeDieResult: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        faithDieResult: new fields.NumberField({ required: true, integer: true, initial: 0 }),
        giftsGranted: new fields.BooleanField({ required: true, initial: false }),
        // How many Attribute Bonuses (Step 10) have been applied per attribute.
        attrBonusApplied: new fields.ObjectField({ required: true, initial: {} })
      })
    };
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  /** @override */
  prepareBaseData() {
    this.#calculateAbilities();
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

  /** Step 10 Attribute Bonus effects (p.60). */
  static ATTR_BONUS_EFFECTS = {
    int: "increase any Craft by +1 (RoH)",
    wis: "increase any Gift by +1 (RoH)",
    pat: "increase Faith by +1d4 (GE)",
    will: "increase any Saving Throw by +1 (RoH)",
    mem: "increase any Talent by +1 (RoH)",
    str: "increase Damage by +1",
    agi: "increase any AtR by +1",
    spd: "increase Dodge by +1",
    end: "increase Life by +1d4 (GE)",
    bty: "add 2d4 x 50g",
    cha: "add 2d4 x 50g",
    vir: "lose one (1) Sin"
  };

  /** Height by Stature, indexed by d12-1 (Genesis p.56). */
  static HEIGHT_TABLE = {
    weeFolk: ["2' 8\"", "2' 9\"", "2' 11\"", "3' 0\"", "3' 1\"", "3' 2\"", "3' 4\"", "3' 5\"", "3' 6\"", "3' 7\"", "3' 9\"", "3' 10\""],
    dwarfolk: ["4' 0\"", "4' 1\"", "4' 3\"", "4' 4\"", "4' 5\"", "4' 6\"", "4' 8\"", "4' 9\"", "4' 10\"", "4' 11\"", "5' 1\"", "5' 2\""],
    commonFolk: ["5' 4\"", "5' 5\"", "5' 7\"", "5' 8\"", "5' 9\"", "5' 10\"", "6' 0\"", "6' 1\"", "6' 2\"", "6' 3\"", "6' 5\"", "6' 6\""],
    giantFolk: ["6' 8\"", "6' 9\"", "6' 11\"", "7' 0\"", "7' 1\"", "7' 2\"", "7' 4\"", "7' 5\"", "7' 6\"", "7' 7\"", "7' 9\"", "7' 10\""]
  };

  /** Weight in lbs by STR (rows 2-20) x height-is-less-than column (p.57). */
  static WEIGHT_THRESHOLDS_INCHES = [36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96];
  static WEIGHT_TABLE = {
    2: [19, 22, 25, 28, 31, 34, 37, 41, 44, 47, 50],
    3: [28, 33, 37, 42, 47, 51, 56, 61, 66, 70, 75],
    4: [37, 44, 50, 56, 62, 69, 75, 81, 87, 94, 100],
    5: [47, 55, 62, 70, 78, 86, 94, 101, 109, 117, 125],
    6: [56, 66, 75, 84, 94, 103, 112, 122, 131, 140, 150],
    7: [66, 76, 87, 98, 109, 120, 131, 142, 153, 164, 175],
    8: [75, 87, 100, 112, 125, 137, 150, 162, 175, 187, 200],
    9: [84, 98, 112, 126, 140, 154, 168, 183, 197, 211, 225],
    10: [94, 109, 125, 140, 156, 172, 187, 203, 218, 234, 250],
    11: [103, 120, 137, 154, 172, 189, 206, 223, 240, 257, 275],
    12: [112, 131, 150, 168, 187, 206, 225, 243, 262, 281, 300],
    13: [122, 142, 162, 183, 203, 223, 243, 264, 284, 304, 324],
    14: [131, 153, 175, 197, 218, 240, 262, 284, 306, 328, 349],
    15: [140, 164, 187, 211, 234, 257, 281, 304, 328, 351, 374],
    16: [150, 175, 200, 225, 250, 275, 300, 324, 349, 374, 399],
    17: [159, 186, 212, 239, 265, 292, 318, 345, 371, 398, 424],
    18: [168, 197, 225, 253, 281, 309, 337, 365, 393, 421, 449],
    19: [178, 207, 237, 267, 296, 326, 356, 385, 415, 445, 474],
    20: [187, 218, 250, 281, 312, 343, 374, 406, 437, 468, 499]
  };

  /** Native lands and language groups, indexed by d20-1 (p.57). */
  static LANDS = ["Frankish Kingdom", "Spanish Kingdom", "Irish Chiefdoms", "English Kingdom", "Scottish Highlands", "Byzantine Empire", "German Empire", "Seljuk Territories", "Norse Kingdom", "Jerusalem Kingdom", "Roman Empire", "Persian Empire", "Egyptian Sultanate", "Arabian Caliphate", "Chinese Empire", "Japanese Empire", "Mongolian Empire", "Slavic Europe", "Swedish Kingdom", "Danish Kingdom"];
  static LANGUAGE_GROUPS = ["Frankish (Frankish, Italian, Spanish)", "Spanish (Spanish, Portuguese, Italian)", "Irish (Irish, Scottish, English)", "English (English, Frankish, German)", "Gaelic (Scottish, Welsh, Irish)", "Byzantine (Greek, Slavic, Italian)", "Germanic (German, Italian, Frankish)", "Seljuk (Turkish, Italian, Greek)", "Norse (Norse, Danish, Swedish)", "Biblical (Hebrew, Greek, Aramaic)", "Roman (Italian, German, Greek)", "Persian (Persian, Egyptian, Hebrew)", "Egyptian (Egyptian, Berber, Arabic)", "Arabic (Arabic, Persian, Aramaic)", "Chinese (Chinese, Japanese, Mongolian)", "Japanese (Japanese, Chinese, Mongolian)", "Mongolia (Mongolian, Chinese, Turkish)", "Slavic (Slavic, Turkish, German)", "Swedish (Swedish, Norse, German)", "Danish (Danish, Swedish, German)"];

  /** Sins and Phobias d20 tables (p.56). */
  static SINS = ["Attachment", "Bitterness", "Cheating", "Control", "Cruelty", "Doubt", "Drunkenness", "Envy", "Gluttony", "Gossip", "Greed", "Laziness", "Lying", "Malice", "Paganism", "Prejudice", "Pride", "Strife", "Theft", "Vanity"];
  static PHOBIAS = ["Being Alone", "Being Followed", "Being Touched", "Blood (of self)", "Bums and Beggars", "Complete Darkness", "Confined Spaces", "Crowds", "Cursed People", "Graveyards", "Heights", "Insects", "Laughter (paranoia)", "Magic/Spellcasters", "Rejection", "Rodents", "Sick/Diseased People", "Silence", "Snakes", "Toads, Frogs, Lizards"];

  /** How many Sins/Phobias an AV grants (p.56: VIR -> Sins, WIL -> Phobias). */
  static sinPhobiaCount(av) {
    if (av >= 12) return 0;
    if (av >= 10) return 1;
    if (av >= 8) return 2;
    if (av >= 6) return 3;
    return 4;
  }

  /** Faith creation attributes by class (Ch7), fallback when no class item. */
  static CLASS_FAITH_ATTRS = {
    bard: ["pat"], cleric: ["pat", "vir"], devilHunter: ["pat"],
    knight: ["pat"], saint: ["pat", "vir"]
  };

  /**
   * Built-in class Attribute requirements (Genesis Ch7), used when no class
   * item provides them (dropdown-selected classes, legacy imports).
   */
  static CLASS_REQUIREMENTS = {
    bard: [["cha", 10], ["int", 8]],
    cleric: [["int", 10], ["wis", 8]],
    devilHunter: [["will", 10], ["int", 8]],
    jester: [["agi", 10], ["cha", 8]],
    knight: [["end", 10], ["str", 8]],
    saint: [["wis", 10], ["pat", 8]],
    saisier: [["agi", 10], ["str", 8]],
    scout: [["wis", 10], ["agi", 8]],
    spy: [["agi", 10], ["spd", 8]],
    voyager: [["int", 10], ["cha", 8]],
    warrior: [["str", 10], ["end", 8]]
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

  /** Embedded skill items grouped by section (gift/talent/craft). */
  get skillsByType() {
    const groups = { gift: [], talent: [], craft: [] };
    for (const item of this.parent.items) {
      if (item.type === "skill") (groups[item.system.skillType] ??= []).push(item);
    }
    return groups;
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

    // Gather skill items with their PF. Prefer structured links
    // (combatAbilities flag / weaponSkillKey); fall back to name regex for
    // hand-typed skills that predate the structured fields.
    const skillItems = this.parent.items.filter(i => i.type === "skill");
    const slots = skillItems.map(i => ({
      name: i.name,
      pf: i.system.pf || 0,
      combatAbilities: i.system.combatAbilities === true,
      weaponSkillKey: i.system.weaponSkillKey || ""
    }));
    const isCombatAbilities = x => x.combatAbilities || cls.COMBAT_ABILITIES_PATTERN.test(x.name);
    const matchesWS = (x, key) => (x.weaponSkillKey === key) || (!x.weaponSkillKey && cls.WS_PATTERNS[key]?.test(x.name));

    // --- Step 7: Combat Abilities budget + Rule of Halves ---
    const caBudget = slots
      .filter(isCombatAbilities)
      .reduce((sum, x) => sum + x.pf, 0);
    const c = this.combat;
    const caValues = [c.advantageBonus || 0, c.dodgeBonus || 0, c.defendBonus || 0, c.damageBonus || 0];
    const caSpent = caValues.reduce((a, b) => a + b, 0);
    const sorted = [...caValues].sort((a, b) => b - a);
    const halvesViolation = (sorted[0] > 7) && (sorted[1] < Math.ceil(sorted[0] / 2));

    const ca = {
      budget: caBudget,
      spent: caSpent,
      hasSkill: slots.some(isCombatAbilities),
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
      const matches = slots.filter(x => matchesWS(x, key));
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

    // Rule of Halves on Saving Throw Bonuses (p.55: takes effect at +3):
    // the second-highest Bonus must be at least half the highest.
    const saveValues = Object.values(this.saves).map(x => x.value || 0).sort((a, b) => b - a);
    const savesWarnings = [];
    if ((saveValues[0] >= 3) && (saveValues[1] < Math.ceil(saveValues[0] / 2))) {
      savesWarnings.push(`Rule of Halves: with a +${saveValues[0]} Save Bonus the second highest must be at least +${Math.ceil(saveValues[0] / 2)}`);
    }
    this.savesValidation = { warnings: savesWarnings };

    // Step 5 details: age range from AVs (min = highest + lowest,
    // max = 2 x sum of the two highest), and expected Sins/Phobias counts.
    const avs = Object.values(this.attributes).map(a => a.value || 0).sort((a, b) => b - a);
    const ageMin = avs[0] + avs[avs.length - 1];
    const ageMax = 2 * (avs[0] + avs[1]);
    this.detailsValidation = {
      ageMin, ageMax,
      ageOutOfRange: (this.age < ageMin) || (this.age > ageMax),
      expectedSins: this.constructor.sinPhobiaCount(this.attributes.vir?.value ?? 9),
      expectedPhobias: this.constructor.sinPhobiaCount(this.attributes.will?.value ?? 9)
    };

    // Step 10 Attribute Bonuses: one bonus per even AV threshold >= 12
    // (12, 14, 16, ...). Track earned vs applied per attribute.
    const applied = this.creation?.attrBonusApplied ?? {};
    const bonusRows = [];
    let totalEarned = 0, totalApplied = 0;
    for (const [key, attr] of Object.entries(this.attributes)) {
      const av = attr.value || 0;
      const earned = (av >= 12) ? Math.floor((av - 10) / 2) : 0;
      const used = applied[key] || 0;
      totalEarned += earned; totalApplied += used;
      if (earned > 0) {
        bonusRows.push({
          key, label: attr.label, av, earned, used,
          remaining: earned - used,
          effect: this.constructor.ATTR_BONUS_EFFECTS[key]
        });
      }
    }
    this.attrBonusValidation = { rows: bonusRows, totalEarned, totalApplied, pending: totalEarned - totalApplied };
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
