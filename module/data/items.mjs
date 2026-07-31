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
      skillType: new fields.StringField({ required: true, initial: "gift", choices: ["gift", "talent", "craft"] }),
      proficiency: new fields.NumberField({ required: true, integer: true, initial: 0 }),
      attribute1: new fields.StringField({ required: true, initial: "str" }),
      attribute2: new fields.StringField({ required: true, initial: "agi" })
    };
  }
}
