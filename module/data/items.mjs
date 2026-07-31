const fields = foundry.data.fields;

/** Fields shared by every item type (the old template.json "base" template). */
function baseItemSchema() {
  return {
    description: new fields.HTMLField({ required: true, initial: "" }),
    quantity: new fields.NumberField({ required: true, integer: true, initial: 1, min: 0 }),
    weight: new fields.NumberField({ required: true, initial: 0, min: 0 }),
    cost: new fields.SchemaField({
      gold: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      silver: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 })
    })
  };
}

export class WeaponData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      weaponSkill: new fields.StringField({ required: true, initial: "lightArms" }),
      damage: new fields.StringField({ required: true, initial: "1d6" }),
      range: new fields.StringField({ required: true, initial: "Melee" }),
      properties: new fields.StringField({ required: true, initial: "" }),
      equipped: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class ArmorData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      ap: new fields.StringField({ required: true, initial: "chest" }),
      aDEF: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      CAP: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      PEN: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      currentADEF: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      currentPEN: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      equipped: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class EquipmentData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      equipped: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class MiracleData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      level: new fields.NumberField({ required: true, integer: true, initial: 1, min: 1 }),
      faithCost: new fields.NumberField({ required: true, integer: true, initial: 7, min: 0 }),
      range: new fields.StringField({ required: true, initial: "Touch" }),
      duration: new fields.StringField({ required: true, initial: "Instantaneous" }),
      target: new fields.StringField({ required: true, initial: "Single" }),
      area: new fields.StringField({ required: true, initial: "" }),
      miracleType: new fields.StringField({ required: true, initial: "high", choices: ["high", "clerical"] })
    };
  }
}

export class BlessingData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      duration: new fields.StringField({ required: true, initial: "Permanent" }),
      effect: new fields.StringField({ required: true, initial: "" })
    };
  }
}

export class SkillData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      ...baseItemSchema(),
      // gift / talent / craft (the sheet section) - matches the paper sheet.
      skillType: new fields.StringField({ required: true, initial: "gift", choices: ["gift", "talent", "craft"] }),
      // Proficiency Factor: the single "+PF" number on the sheet.
      pf: new fields.NumberField({ required: true, integer: true, initial: 0 }),

      // Structured links so validation reads data, not skill names:
      // - combatAbilities: this is the "Combat Abilities" skill (Step 7 budget)
      // - weaponSkillKey: this is a "WS <name>" skill for the given key (Step 8)
      combatAbilities: new fields.BooleanField({ required: true, initial: false }),
      weaponSkillKey: new fields.StringField({ required: true, blank: true, initial: "", choices: [
        "", "handToHand", "lightArms", "heavyArms", "pairedWeapons", "missile", "thrown", "kickAttack"
      ] }),

      // Optional metadata for Chapter 4 / CS combat skills.
      prerequisite: new fields.StringField({ required: true, initial: "" }),
      isCombatSkill: new fields.BooleanField({ required: true, initial: false })
    };
  }
}

export class ClassData extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      description: new fields.HTMLField({ required: true, initial: "" }),
      key: new fields.StringField({ required: true, initial: "adventurer" }),
      requirements: new fields.StringField({ required: true, initial: "" }),

      // Step 2A (p.53): Primary/Secondary Attribute requirements. Empty
      // attribute = no requirement (Adventurer, Fighter).
      primaryAttribute: new fields.StringField({ required: true, initial: "" }),
      primaryMin: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),
      secondaryAttribute: new fields.StringField({ required: true, initial: "" }),
      secondaryMin: new fields.NumberField({ required: true, integer: true, initial: 0, min: 0 }),

      // Creation: Life = STR + END + lifeCreationDie(GE)
      lifeCreationDie: new fields.StringField({ required: true, initial: "1d6" }),
      // Per level: add lifePerLevelDie(GE) to max and current Life
      lifePerLevelDie: new fields.StringField({ required: true, initial: "1d4" }),

      // Creation: Faith = (sum of faithCreationAttrs AVs) + faithCreationDie(GE)
      faithCreationAttrs: new fields.ArrayField(new fields.StringField()),
      faithCreationDie: new fields.StringField({ required: true, initial: "1d4" }),
      // Per level: add faithPerLevelDie(GE) to max and current Faith
      faithPerLevelDie: new fields.StringField({ required: true, initial: "1d4" }),

      // Statures this class may be (Genesis p.53 / Ch7)
      statures: new fields.ArrayField(new fields.StringField(), {
        initial: ["weeFolk", "dwarfolk", "commonFolk", "giantFolk"]
      }),

      blessingsType: new fields.StringField({ required: true, initial: "" }),
      grantedGifts: new fields.StringField({ required: true, initial: "" }),
      startingEquipment: new fields.StringField({ required: true, initial: "" })
    };
  }
}
