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
    
    // Calculate Defense values
    this._calculateDefense(systemData);
    
    // Reset AtR at start of round (if needed)
    this._resetAtR(systemData);
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

    // Climb = (WIL + STR) / 2, rounded up
    abilities.climb.value = Math.ceil((attrs.will.value + attrs.str.value) / 2);
    abilities.climb.mod = abilities.climb.value + (abilities.climb.bonus || 0);

    // Jump = (WIL + AGI) / 2, rounded up
    abilities.jump.value = Math.ceil((attrs.will.value + attrs.agi.value) / 2);
    abilities.jump.mod = abilities.jump.value + (abilities.jump.bonus || 0);

    // Balance = (PAT + AGI) / 2, rounded up
    abilities.balance.value = Math.ceil((attrs.pat.value + attrs.agi.value) / 2);
    abilities.balance.mod = abilities.balance.value + (abilities.balance.bonus || 0);

    // Hide = (WIS + SPD) / 2, rounded up
    abilities.hide.value = Math.ceil((attrs.wis.value + attrs.spd.value) / 2);
    abilities.hide.mod = abilities.hide.value + (abilities.hide.bonus || 0);

    // Appeal = (CHA + VIR) / 2, rounded up
    abilities.appeal.value = Math.ceil((attrs.cha.value + attrs.vir.value) / 2);
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

    // Calculate defense values for all actor types
    if (systemData.defense) {
      this._calculateDefense(systemData);
    }

    // Make modifications to data after effects applied
  }

  /**
   * Calculate defense values from equipped armor
   */
  _calculateDefense(systemData) {
    if (!systemData.defense) return;
    
    const defense = systemData.defense;
    const aDEFByAP = defense.aDEFByAP || {};
    
    // Reset armor values by AP slot
    const apSlots = ['head', 'chest', 'arms', 'legs', 'back', 'feet'];
    apSlots.forEach(slot => {
      aDEFByAP[slot] = 0;
    });
    
    // Find equipped armor items and calculate highest aDEF per slot
    const equippedArmor = this.items.filter(item => 
      item.type === 'armor' && item.system.equipped === true
    );
    
    // For each AP slot, find the highest aDEF value
    apSlots.forEach(slot => {
      const slotArmor = equippedArmor.filter(armor => 
        armor.system.ap === slot
      );
      
      if (slotArmor.length > 0) {
        // Use currentADEF if available, otherwise use aDEF
        const maxADEF = Math.max(...slotArmor.map(armor => {
          const currentADEF = armor.system.currentADEF !== undefined 
            ? armor.system.currentADEF 
            : armor.system.aDEF;
          return currentADEF || 0;
        }));
        aDEFByAP[slot] = maxADEF;
      }
    });
    
    // Calculate total armor defense
    defense.aDEFTotal = Object.values(aDEFByAP).reduce((sum, val) => sum + val, 0);
    
    // Calculate total defense (nDEF + aDEFTotal)
    defense.tDEF = (defense.nDEF || 4) + defense.aDEFTotal;
    
    // Calculate armor penalty total (sum of PEN from equipped armor)
    defense.armorPenaltyTotal = equippedArmor.reduce((sum, armor) => {
      const currentPEN = armor.system.currentPEN !== undefined 
        ? armor.system.currentPEN 
        : armor.system.PEN;
      return sum + (currentPEN || 0);
    }, 0);
  }

  /**
   * Reset AtR for all weapon skills (called at start of round)
   */
  _resetAtR(systemData) {
    if (!systemData.weaponSkills) return;
    
    Object.keys(systemData.weaponSkills).forEach(skillKey => {
      const skill = systemData.weaponSkills[skillKey];
      if (skill.atRMax !== undefined) {
        skill.atRCurrent = skill.atRMax;
      }
    });
  }

  /**
   * Get AtR for a weapon skill
   */
  getAtR(weaponSkillKey) {
    const skill = this.system.weaponSkills?.[weaponSkillKey];
    return {
      max: skill?.atRMax || 1,
      current: skill?.atRCurrent || 1
    };
  }

  /**
   * Consume AtR for a weapon skill
   */
  async consumeAtR(weaponSkillKey, amount = 1) {
    const skill = this.system.weaponSkills?.[weaponSkillKey];
    if (!skill) return false;
    
    const current = skill.atRCurrent || 0;
    if (current < amount) return false;
    
    skill.atRCurrent = Math.max(0, current - amount);
    await this.update({ 'system.weaponSkills': this.system.weaponSkills });
    return true;
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
  async rollSave(saveKey, df = null) {
    const save = this.system.saves[saveKey];
    if (!save) return;

    const resolvedDf = Number.isFinite(df) ? df : (save.df ?? 10);
    const roll = new Roll("1d20 + @bonus", { bonus: save.value });
    await roll.evaluate();

    const success = roll.total >= resolvedDf;
    const critSuccess = roll.terms[0].results?.some(r => r.result === 20);
    const critFail = roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${save.label} Save (DF ${resolvedDf})`;
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
   * Roll advantage for combat initiative
   */
  async rollAdvantage() {
    const advantageBonus = this.system.combat?.advantageBonus || 0;
    const roll = new Roll("1d20 + @bonus", { bonus: advantageBonus });
    await roll.evaluate();

    const flavor = `Advantage Roll: ${roll.total}`;

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return { roll, result: roll.total };
  }

  /**
   * Roll an attack against a target
   */
  async rollAttack(weapon, targetActor = null) {
    const weaponSkill = weapon?.system?.weaponSkill || 'lightArms';
    const ws = this.system.weaponSkills?.[weaponSkill];
    if (!ws) {
      ui.notifications.error(`Weapon skill ${weaponSkill} not found`);
      return;
    }

    // Check AtR
    const atr = this.getAtR(weaponSkill);
    if (atr.current < 1) {
      ui.notifications.warn(`No AtR remaining for ${ws.label}`);
      return;
    }

    const attackBonus = ws.attackBonus || 0;
    const roll = new Roll("1d20 + @bonus", { bonus: attackBonus });
    await roll.evaluate();

    const attackTotal = roll.total;
    // Extract natural roll from dice terms
    let natRoll = null;
    for (const term of roll.terms) {
      if (term.results && term.results.length > 0) {
        natRoll = term.results[0].result;
        break;
      }
    }
    const isNat20 = natRoll === 20;
    const isNat1 = natRoll === 1;

    // Handle Nat 1: Automatic failure, set halfDefenseFlag
    if (isNat1) {
      await this.update({ 'system.combat.halfDefenseFlag': true });
      await this.consumeAtR(weaponSkill, 1);
      
      const flavor = `${weapon?.name || 'Unarmed'} Attack: <strong>Natural 1 - Automatic Failure!</strong>`;
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll]
      };
      return ChatMessage.create(chatData);
    }

    // If no target, just show attack roll
    if (!targetActor) {
      await this.consumeAtR(weaponSkill, 1);
      const flavor = `${weapon?.name || 'Unarmed'} Attack: ${attackTotal}${isNat20 ? ' (Natural 20!)' : ''}`;
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll]
      };
      return ChatMessage.create(chatData);
    }

    // Get defender's tDEF
    const defenderTDEF = targetActor.system?.defense?.tDEF || 4;

    // GATE A: Check if attack fails immediately
    if (attackTotal <= defenderTDEF) {
      await this.consumeAtR(weaponSkill, 1);
      
      const flavor = `${weapon?.name || 'Unarmed'} Attack: ${attackTotal} vs tDEF ${defenderTDEF} - <strong>Attack Failed (Gate A)</strong>`;
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [roll]
      };
      return ChatMessage.create(chatData);
    }

    // Attack passed Gate A - prompt defender for Dodge or Defend
    if (targetActor.isOwner) {
      const defenseChoice = await this._promptDefenseChoice(targetActor);
      if (!defenseChoice) {
        await this.consumeAtR(weaponSkill, 1);
        return;
      }

      return this._resolveDefense(weapon, targetActor, attackTotal, isNat20, defenseChoice);
    } else {
      // NPC or non-owned actor - auto-choose defend
      return this._resolveDefense(weapon, targetActor, attackTotal, isNat20, 'defend');
    }
  }

  /**
   * Prompt defender to choose Dodge or Defend
   */
  async _promptDefenseChoice(defender) {
    return new Promise((resolve) => {
      new Dialog({
        title: `${defender.name} - Choose Defense`,
        content: `
          <form>
            <div class="form-group">
              <label>Choose your defense:</label>
              <select name="defenseType" autofocus>
                <option value="dodge">Dodge (${defender.system.combat?.dodgeBonus || 0} bonus)</option>
                <option value="defend">Defend (${defender.system.combat?.defendBonus || 0} bonus)</option>
              </select>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            label: "Roll Defense",
            callback: (html) => {
              const defenseType = html.find('[name="defenseType"]').val();
              resolve(defenseType);
            }
          },
          cancel: {
            label: "Cancel",
            callback: () => resolve(null)
          }
        },
        default: "roll"
      }).render(true);
    });
  }

  /**
   * Resolve defense roll and determine hit/miss
   */
  async _resolveDefense(weapon, defender, attackTotal, isNat20Attack, defenseType) {
    const defenderBonus = defenseType === 'dodge' 
      ? (defender.system.combat?.dodgeBonus || 0)
      : (defender.system.combat?.defendBonus || 0);
    
    const defenseRoll = new Roll("1d20 + @bonus", { bonus: defenderBonus });
    await defenseRoll.evaluate();

    const defenseTotal = defenseRoll.total;
    // Extract natural roll from dice terms
    let natRollDefense = null;
    for (const term of defenseRoll.terms) {
      if (term.results && term.results.length > 0) {
        natRollDefense = term.results[0].result;
        break;
      }
    }
    const isNat20Defense = natRollDefense === 20;
    const isNat1Defense = natRollDefense === 1;

    // Apply halfDefenseFlag if set
    let finalDefenseTotal = defenseTotal;
    if (defender.system.combat?.halfDefenseFlag) {
      finalDefenseTotal = Math.floor(defenseTotal / 2);
      await defender.update({ 'system.combat.halfDefenseFlag': false });
    }

    // Handle Nat 20 Defense: Automatic success + free attack
    if (isNat20Defense) {
      const weaponSkill = weapon?.system?.weaponSkill || 'lightArms';
      await this.consumeAtR(weaponSkill, 1);
      
      const flavor = `${defender.name} rolled <strong>Natural 20 Defense!</strong> Attack blocked. Free counter-attack granted.`;
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [defenseRoll]
      };
      await ChatMessage.create(chatData);
      
      // TODO: Trigger free attack (would need to be handled by combat system)
      return;
    }

    // Handle Nat 1 Defense: Automatic failure, 1.5x damage
    if (isNat1Defense) {
      const weaponSkill = weapon?.system?.weaponSkill || 'lightArms';
      await this.consumeAtR(weaponSkill, 1);
      
      const flavor = `${defender.name} rolled <strong>Natural 1 Defense!</strong> Automatic failure. Damage will be ×1.5.`;
      const chatData = {
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor,
        type: CONST.CHAT_MESSAGE_TYPES.ROLL,
        rolls: [defenseRoll]
      };
      await ChatMessage.create(chatData);
      
      return this._resolveDamage(weapon, defender, attackTotal, isNat20Attack, true, true);
    }

    // Normal defense resolution: ties go to defender
    const attackHits = finalDefenseTotal < attackTotal;
    
    const weaponSkill = weapon?.system?.weaponSkill || 'lightArms';
    await this.consumeAtR(weaponSkill, 1);

    let flavor = `${weapon?.name || 'Unarmed'} Attack: ${attackTotal} vs ${defenseType.capitalize()} ${finalDefenseTotal}`;
    if (!attackHits) {
      flavor += ` - <strong>Defended!</strong>`;
    } else {
      flavor += ` - <strong>Hit!</strong>`;
    }

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [defenseRoll]
    };
    await ChatMessage.create(chatData);

    if (attackHits) {
      return this._resolveDamage(weapon, defender, attackTotal, isNat20Attack, false, false);
    } else {
      // Successful defense - check for return attack
      const atr = this.getAtR(weaponSkill);
      if (atr.current > 0) {
        // Offer return attack option (would need UI prompt)
        // For now, just consume AtR from taking damage (defender takes 1 AtR damage)
        await defender._consumeAtRFromDamage();
      }
    }
  }

  /**
   * Consume AtR when taking damage
   */
  async _consumeAtRFromDamage() {
    // When taking damage, consume 1 AtR from all weapon skills
    // For simplicity, consume from first available skill
    const weaponSkills = this.system.weaponSkills || {};
    for (const [key, skill] of Object.entries(weaponSkills)) {
      if (skill.atRCurrent > 0) {
        await this.consumeAtR(key, 1);
        break;
      }
    }
  }

  /**
   * Resolve damage and apply armor degradation
   */
  async _resolveDamage(weapon, defender, attackTotal, isNat20Attack, isNat1Defense, isNat20Defense) {
    let damageFormula = weapon?.system?.damage || "1d4";
    const damageBonus = this.system.combat?.damageBonus || 0;
    
    // Roll damage dice
    const damageRoll = new Roll(damageFormula);
    await damageRoll.evaluate();
    
    let finalDamage = damageRoll.total;
    
    // Apply multipliers BEFORE adding bonus
    if (isNat20Attack && !isNat20Defense) {
      finalDamage = finalDamage * 2;
    }
    
    if (isNat1Defense) {
      finalDamage = Math.floor(finalDamage * 1.5);
    }
    
    // Add damage bonus AFTER multiplication
    finalDamage += damageBonus;
    
    // Determine hit location (default: chest)
    const hitAP = 'chest'; // Could be randomized or chosen
    
    // Apply armor degradation
    await this._applyArmorDegradation(defender, hitAP, finalDamage);
    
    // Apply damage to life
    const currentLife = defender.system.life?.value || 0;
    const newLife = Math.max(0, currentLife - finalDamage);
    await defender.update({ 'system.life.value': newLife });
    
    // Consume AtR from damage
    if (defender && typeof defender._consumeAtRFromDamage === 'function') {
      await defender._consumeAtRFromDamage();
    }
    
    const flavor = `${weapon?.name || 'Unarmed'} Damage: ${finalDamage} (${damageRoll.total}${isNat20Attack ? ' ×2' : ''}${isNat1Defense ? ' ×1.5' : ''}${damageBonus > 0 ? ` + ${damageBonus}` : ''})`;
    
    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [damageRoll]
    };
    
    return ChatMessage.create(chatData);
  }

  /**
   * Apply armor degradation based on CAP system
   */
  async _applyArmorDegradation(defender, hitAP, damageAmount) {
    const equippedArmor = defender.items.filter(item => 
      item.type === 'armor' && 
      item.system.equipped === true && 
      item.system.ap === hitAP
    );
    
    if (equippedArmor.length === 0) return;
    
    // Use the armor piece with highest aDEF (should only be one per slot due to stacking)
    const armor = equippedArmor[0];
    const cap = armor.system.CAP || 0;
    
    if (cap <= 0 || damageAmount < cap) return;
    
    const reductionSteps = Math.floor(damageAmount / cap);
    let currentADEF = armor.system.currentADEF !== undefined 
      ? armor.system.currentADEF 
      : armor.system.aDEF;
    let currentPEN = armor.system.currentPEN !== undefined 
      ? armor.system.currentPEN 
      : armor.system.PEN;
    
    for (let i = 0; i < reductionSteps; i++) {
      if (currentADEF > 0) {
        currentADEF -= 1;
      } else if (currentPEN > 0) {
        currentPEN -= 1;
      } else {
        break; // Armor fully degraded
      }
    }
    
    await armor.update({
      'system.currentADEF': currentADEF,
      'system.currentPEN': currentPEN
    });
    
    // Recalculate defender's defense
    if (defender && typeof defender._calculateDefense === 'function') {
      defender._calculateDefense(defender.system);
      await defender.update({ 'system.defense': defender.system.defense });
    }
  }

  /**
   * Roll damage (legacy method for manual damage rolls)
   */
  async rollDamage(weapon, isCritical = false) {
    let damageFormula = weapon?.system?.damage || "1d4";
    const damageBonus = this.system.combat?.damageBonus || 0;
    
    // For critical, multiply dice first, then add bonus
    if (isCritical) {
      damageFormula = `(${damageFormula}) * 2`;
    }
    
    // Add damage bonus after multiplication
    damageFormula += ` + ${damageBonus}`;

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
