/**
 * Shared field-construction helpers for Holy Lands RPG data models.
 */
const fields = foundry.data.fields;

/** A value/max resource such as Life or Faith. */
export function resourceField(initialValue, initialMax) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial: initialValue }),
    max: new fields.NumberField({ required: true, integer: true, initial: initialMax })
  });
}

/** A core attribute (d12 roll-under). */
export function attributeField(label) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial: 9, min: 0 }),
    label: new fields.StringField({ required: true, initial: label })
  });
}

/** The twelve Holy Lands attributes. */
export function attributesSchema() {
  return new fields.SchemaField({
    int: attributeField("Intellect"),
    wis: attributeField("Wisdom"),
    pat: attributeField("Patience"),
    will: attributeField("Will"),
    mem: attributeField("Memory"),
    str: attributeField("Strength"),
    agi: attributeField("Agility"),
    spd: attributeField("Speed"),
    end: attributeField("Endurance"),
    bty: attributeField("Beauty"),
    cha: attributeField("Charisma"),
    vir: attributeField("Virtue")
  });
}

/** A derived ability (Perception, Search, etc). value and mod are recomputed in prep. */
export function abilityField(label) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    bonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    mod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    label: new fields.StringField({ required: true, initial: label })
  });
}

export function abilitiesSchema() {
  return new fields.SchemaField({
    perception: abilityField("Perception"),
    search: abilityField("Search"),
    climb: abilityField("Climb"),
    jump: abilityField("Jump"),
    balance: abilityField("Balance"),
    hide: abilityField("Hide"),
    appeal: abilityField("Appeal")
  });
}

/** A saving throw with its fixed Difficulty Factor. */
export function saveField(label, df) {
  return new fields.SchemaField({
    value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    df: new fields.NumberField({ required: true, integer: true, initial: df }),
    label: new fields.StringField({ required: true, initial: label })
  });
}

/**
 * A named, freely-renamable skill slot (Gifts / Talents / Crafts).
 * The single visible PF box is `value`; `mod` mirrors it in data prep.
 * (The legacy `bonus` field was removed in v2.1.2 - stored values are
 * stripped by schema cleaning and never contribute to rolls.)
 */
export function skillField(label) {
  return new fields.SchemaField({
    name: new fields.StringField({ required: true, initial: "" }),
    value: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    mod: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    label: new fields.StringField({ required: true, initial: label })
  });
}

/** Build a record of numbered skill slots, e.g. skillSlots("gift", "Gift", 7). */
export function skillSlots(prefix, label, count) {
  const schema = {};
  for (let i = 1; i <= count; i++) {
    schema[`${prefix}${i}`] = skillField(`${label} ${i}`);
  }
  return new fields.SchemaField(schema);
}

/** A weapon skill with Attacks-per-Round tracking. */
export function weaponSkillField(label, atr) {
  return new fields.SchemaField({
    attackBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    criticalBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    specialBonus: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    atRMax: new fields.NumberField({ required: true, integer: true, initial: atr, min: 0 }),
    atRCurrent: new fields.NumberField({ required: true, integer: true, initial: atr, min: 0 }),
    label: new fields.StringField({ required: true, initial: label })
  });
}

/** Defense block shared by characters and NPCs. */
export function defenseSchema() {
  const apSlot = () => new fields.NumberField({ required: true, integer: true, initial: 0 });
  return new fields.SchemaField({
    nDEF: new fields.NumberField({ required: true, integer: true, initial: 4 }),
    aDEFByAP: new fields.SchemaField({
      head: apSlot(),
      chest: apSlot(),
      arms: apSlot(),
      legs: apSlot(),
      back: apSlot(),
      feet: apSlot()
    }),
    aDEFTotal: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    tDEF: new fields.NumberField({ required: true, integer: true, initial: 4 }),
    armorPenaltyTotal: new fields.NumberField({ required: true, integer: true, initial: 0 }),
    tDEFOverride: new fields.NumberField({ required: false, integer: true, nullable: true, initial: null }),
    tDEFSource: new fields.StringField({ required: true, initial: "" })
  });
}

/**
 * Shared derived-defense calculation: equipped armor -> aDEF per AP slot,
 * totals, and armour penalty. Mirrors the pre-2.0 logic exactly.
 * @param {object} systemData  The actor's system data (mutated in place)
 * @param {Actor} actor        The owning actor document (for embedded items)
 */
export function calculateDefense(systemData, actor) {
  const defense = systemData.defense;
  if (!defense) return;

  const apSlots = ["head", "chest", "arms", "legs", "back", "feet"];
  const equippedArmor = actor.items.filter(i => (i.type === "armor") && (i.system.equipped === true));

  for (const slot of apSlots) {
    const slotArmor = equippedArmor.filter(a => a.system.ap === slot);
    if (slotArmor.length > 0) {
      defense.aDEFByAP[slot] = Math.max(...slotArmor.map(a => {
        const current = (a.system.currentADEF !== undefined) ? a.system.currentADEF : a.system.aDEF;
        return current || 0;
      }));
    }
    else defense.aDEFByAP[slot] = 0;
  }

  defense.aDEFTotal = Object.values(defense.aDEFByAP).reduce((sum, v) => sum + v, 0);
  defense.tDEF = (defense.nDEF || 4) + defense.aDEFTotal;
  // Direct tDEF override (e.g. a monster's natural armor: "hardened muscle
  // and flesh [15]") takes precedence over the computed value.
  if (Number.isFinite(defense.tDEFOverride) && (defense.tDEFOverride > 0)) {
    defense.tDEF = defense.tDEFOverride;
  }
  defense.armorPenaltyTotal = equippedArmor.reduce((sum, a) => {
    const pen = (a.system.currentPEN !== undefined) ? a.system.currentPEN : a.system.PEN;
    return sum + (pen || 0);
  }, 0);
}
