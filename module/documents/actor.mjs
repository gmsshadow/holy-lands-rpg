/**
 * Extend the base Actor document for Holy Lands RPG
 */
export class HolyLandsActor extends Actor {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    const actorData = this;
    const systemData = actorData.system;

    // Calculate derived values for characters
    if (actorData.type === 'character') {
      this._prepareCharacterData(systemData);
    }
  }

  /**
   * Prepare Character specific data
   */
  _prepareCharacterData(systemData) {
    // Calculate Abilities from Attributes
    this._calculateAbilities(systemData);
    
    // Calculate maximum Life
    this._calculateLife(systemData);
    
    // Calculate maximum Faith
    this._calculateFaith(systemData);
  }

  /**
   * Calculate ability proficiency factors from attributes
   */
  _calculateAbilities(systemData) {
    const attrs = systemData.attributes;
    const abilities = systemData.abilities;

    // Perception = (INT + WIS) / 2, rounded up
    abilities.perception.value = Math.ceil((attrs.int.value + attrs.wis.value) / 2);
    abilities.perception.mod = abilities.perception.value + (abilities.perception.bonus || 0);

    // Search = (INT + PAT) / 2, rounded up
    abilities.search.value = Math.ceil((attrs.int.value + attrs.pat.value) / 2);
    abilities.search.mod = abilities.search.value + (abilities.search.bonus || 0);

    // Climb = (STR + AGI) / 2, rounded up
    abilities.climb.value = Math.ceil((attrs.str.value + attrs.agi.value) / 2);
    abilities.climb.mod = abilities.climb.value + (abilities.climb.bonus || 0);

    // Jump = (STR + SPD) / 2, rounded up
    abilities.jump.value = Math.ceil((attrs.str.value + attrs.spd.value) / 2);
    abilities.jump.mod = abilities.jump.value + (abilities.jump.bonus || 0);

    // Balance = (AGI + END) / 2, rounded up
    abilities.balance.value = Math.ceil((attrs.agi.value + attrs.end.value) / 2);
    abilities.balance.mod = abilities.balance.value + (abilities.balance.bonus || 0);

    // Hide = (AGI + SPD) / 2, rounded up
    abilities.hide.value = Math.ceil((attrs.agi.value + attrs.spd.value) / 2);
    abilities.hide.mod = abilities.hide.value + (abilities.hide.bonus || 0);

    // Appeal = (CHA + BTY) / 2, rounded up
    abilities.appeal.value = Math.ceil((attrs.cha.value + attrs.bty.value) / 2);
    abilities.appeal.mod = abilities.appeal.value + (abilities.appeal.bonus || 0);
  }

  /**
   * Calculate maximum Life based on level and class
   */
  _calculateLife(systemData) {
    const level = systemData.level || 1;
    const classData = systemData.classData || {};
    const lifePerLevel = classData.lifePerLevel || 6; // Default to d6
    
    // Life is typically rolled at each level
    // For now, use average: base + (average * level)
    const baseLife = classData.baseLife || 10;
    const avgRoll = Math.ceil(lifePerLevel / 2);
    
    systemData.life.max = baseLife + (avgRoll * (level - 1));
    
    // Ensure current doesn't exceed max
    if (systemData.life.value > systemData.life.max) {
      systemData.life.value = systemData.life.max;
    }
  }

  /**
   * Calculate maximum Faith based on level and class
   */
  _calculateFaith(systemData) {
    const level = systemData.level || 1;
    const classData = systemData.classData || {};
    const faithPerLevel = classData.faithPerLevel || 4;
    
    const baseFaith = classData.baseFaith || 5;
    const avgRoll = Math.ceil(faithPerLevel / 2);
    
    systemData.faith.max = baseFaith + (avgRoll * (level - 1));
    
    // Ensure current doesn't exceed max
    if (systemData.faith.value > systemData.faith.max) {
      systemData.faith.value = systemData.faith.max;
    }
  }

  /** @override */
  prepareDerivedData() {
    const actorData = this;
    const systemData = actorData.system;
    const flags = actorData.flags.holyLandsRpg || {};

    // Make modifications to data after effects applied
  }

  /**
   * Roll an attribute check (d12, roll under attribute value)
   */
  async rollAttribute(attributeKey) {
    const attr = this.system.attributes[attributeKey];
    if (!attr) return;

    const roll = new Roll("1d12");
    await roll.evaluate();

    const success = roll.total <= attr.value;
    const critSuccess = roll.total === 1;
    const critFail = roll.total === 12;

    let flavor = `${attr.label} Check (AV ${attr.value})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll an ability check (d20, higher is better)
   */
  async rollAbility(abilityKey, df = 10) {
    const ability = this.system.abilities[abilityKey];
    if (!ability) return;

    const roll = new Roll("1d20 + @mod", { mod: ability.mod });
    await roll.evaluate();

    const success = roll.total >= df;
    const critSuccess = roll.terms[0].results?.some(r => r.result === 20);
    const critFail = roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${ability.label} (DF ${df})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll a skill check (d20, higher is better)
   */
  async rollSkill(skillKey, df = 10) {
    const skill = this.system.skills[skillKey];
    if (!skill) return;

    const roll = new Roll("1d20 + @mod", { mod: skill.mod });
    await roll.evaluate();

    const success = roll.total >= df;
    const critSuccess = roll.terms[0].results?.some(r => r.result === 20);
    const critFail = roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${skill.label} (DF ${df})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll a saving throw
   */
  async rollSave(saveKey, df) {
    const save = this.system.saves[saveKey];
    if (!save) return;

    const roll = new Roll("1d20 + @bonus", { bonus: save.value });
    await roll.evaluate();

    const success = roll.total >= df;
    const critSuccess = roll.terms[0].results?.some(r => r.result === 20);
    const critFail = roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${save.label} Save (DF ${df})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll an attack
   */
  async rollAttack(weapon) {
    const weaponSkill = weapon?.system?.weaponSkill || 'lightArms';
    const ws = this.system.weaponSkills[weaponSkill];
    const attackBonus = ws?.attack || 0;

    const roll = new Roll("1d20 + @bonus", { bonus: attackBonus });
    await roll.evaluate();

    const critSuccess = roll.terms[0].results?.some(r => r.result === 20);
    const critFail = roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${weapon?.name || 'Unarmed'} Attack`;
    if (critSuccess) flavor += " - <strong>Critical Hit!</strong>";
    else if (critFail) flavor += " - <strong>Critical Miss!</strong>";

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll damage
   */
  async rollDamage(weapon, isCritical = false) {
    let damageFormula = weapon?.system?.damage || "1d4";
    const strMod = this.system.attributes.str.value || 0;
    
    // Add strength modifier
    damageFormula += ` + ${strMod}`;
    
    // Double damage on critical
    if (isCritical) {
      damageFormula = `(${damageFormula}) * 2`;
    }

    const roll = new Roll(damageFormula);
    await roll.evaluate();

    const flavor = `${weapon?.name || 'Unarmed'} Damage${isCritical ? ' (Critical)' : ''}`;

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }
}
