/**
 * Extend the base Actor document for Holy Lands RPG.
 *
 * Data preparation now lives on the type data models (module/data/), so this
 * class is responsible for rolls, the attack/defense pipeline and AtR
 * management only.
 */
export class HolyLandsActor extends Actor {

  /** Whether the optional Critical Rolls rule is enabled (world setting). */
  get criticalRollsEnabled() {
    return game.settings.get("holy-lands-rpg", "criticalRolls");
  }

  /* -------------------------------------------- */
  /*  Attacks-per-Round (AtR)                     */
  /* -------------------------------------------- */

  /**
   * Reset AtR for all weapon skills (called at the start of a round).
   * Mutates prepared data only; callers persist via update() where needed.
   */
  _resetAtR(systemData) {
    if (!systemData.weaponSkills) return;
    for (const skill of Object.values(systemData.weaponSkills)) {
      if (skill.atRMax !== undefined) skill.atRCurrent = skill.atRMax;
    }
  }

  /** Persist an AtR reset for every weapon skill. */
  async resetAtRPersisted() {
    const weaponSkills = this.system.weaponSkills;
    if (!weaponSkills) return;
    const update = {};
    for (const [key, skill] of Object.entries(weaponSkills)) {
      if (skill.atRMax !== undefined) {
        update[`system.weaponSkills.${key}.atRCurrent`] = skill.atRMax;
      }
    }
    if (!foundry.utils.isEmpty(update)) await this.update(update);
  }

  /** Get AtR for a weapon skill. */
  getAtR(weaponSkillKey) {
    const skill = this.system.weaponSkills?.[weaponSkillKey];
    return {
      max: skill?.atRMax || 1,
      current: skill?.atRCurrent || 1
    };
  }

  /** Consume AtR for a weapon skill. Returns false if insufficient AtR. */
  async consumeAtR(weaponSkillKey, amount = 1) {
    const skill = this.system.weaponSkills?.[weaponSkillKey];
    if (!skill) return false;

    const current = skill.atRCurrent || 0;
    if (current < amount) return false;

    await this.update({
      [`system.weaponSkills.${weaponSkillKey}.atRCurrent`]: Math.max(0, current - amount)
    });
    return true;
  }

  /** When taking damage, consume 1 AtR from the first available weapon skill. */
  async _consumeAtRFromDamage() {
    const weaponSkills = this.system.weaponSkills || {};
    for (const [key, skill] of Object.entries(weaponSkills)) {
      if (skill.atRCurrent > 0) {
        await this.consumeAtR(key, 1);
        break;
      }
    }
  }

  /* -------------------------------------------- */
  /*  Checks & Saves                              */
  /* -------------------------------------------- */

  /** Roll an attribute check (d12, roll under attribute value). */
  async rollAttribute(attributeKey) {
    const attr = this.system.attributes[attributeKey];
    if (!attr) return;

    const roll = new Roll("1d12");
    await roll.evaluate();

    const success = roll.total <= attr.value;
    const crits = this.criticalRollsEnabled;
    const critSuccess = crits && (roll.total === 1);
    const critFail = crits && (roll.total === 12);

    let flavor = `${attr.label} Check (AV ${attr.value})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [roll]
    });
  }

  /** Roll an ability check (d20 + PF, higher is better). */
  async rollAbility(abilityKey, df = 10) {
    const ability = this.system.abilities[abilityKey];
    if (!ability) return;

    const roll = new Roll("1d20 + @mod", { mod: ability.mod });
    await roll.evaluate();

    const success = roll.total >= df;
    const crits = this.criticalRollsEnabled;
    const critSuccess = crits && roll.terms[0].results?.some(r => r.result === 20);
    const critFail = crits && roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${ability.label} (DF ${df})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [roll]
    });
  }

  /**
   * Roll a skill check (d20 + total, higher is better).
   * @param {string} skillKey  Dot-path within system.skills, e.g. "gifts.gift1"
   */
  async rollSkill(skillKey, df = 10) {
    const skill = foundry.utils.getProperty(this.system.skills, skillKey);
    if (!skill) return;

    const roll = new Roll("1d20 + @mod", { mod: skill.mod });
    await roll.evaluate();

    const success = roll.total >= df;
    const crits = this.criticalRollsEnabled;
    const critSuccess = crits && roll.terms[0].results?.some(r => r.result === 20);
    const critFail = crits && roll.terms[0].results?.some(r => r.result === 1);

    const skillName = skill.name || skill.label;
    let flavor = `${skillName} (DF ${df})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [roll]
    });
  }

  /** Roll a saving throw. Uses the save's own DF unless one is supplied. */
  async rollSave(saveKey, df = null) {
    const save = this.system.saves[saveKey];
    if (!save) return;

    const resolvedDf = Number.isFinite(df) ? df : (save.df ?? 10);
    const roll = new Roll("1d20 + @bonus", { bonus: save.value });
    await roll.evaluate();

    const success = roll.total >= resolvedDf;
    const crits = this.criticalRollsEnabled;
    const critSuccess = crits && roll.terms[0].results?.some(r => r.result === 20);
    const critFail = crits && roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${save.label} Save (DF ${resolvedDf})`;
    if (critSuccess) flavor += " - <strong>Critical Success!</strong>";
    else if (critFail) flavor += " - <strong>Critical Failure!</strong>";
    else if (success) flavor += " - Success";
    else flavor += " - Failed";

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [roll]
    });
  }

  /** Roll advantage for combat initiative. */
  async rollAdvantage() {
    const advantageBonus = this.system.combat?.advantageBonus || 0;
    const roll = new Roll("1d20 + @bonus", { bonus: advantageBonus });
    await roll.evaluate();
    return { roll, result: roll.total };
  }

  /* -------------------------------------------- */
  /*  Attack Pipeline                             */
  /* -------------------------------------------- */

  /** Roll an attack against a target. */
  async rollAttack(weapon, targetActor = null) {
    const weaponSkill = weapon?.system?.weaponSkill || "lightArms";
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

    // Nat 1: automatic failure, set halfDefenseFlag
    if (isNat1) {
      await this.update({ "system.combat.halfDefenseFlag": true });
      await this.consumeAtR(weaponSkill, 1);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weapon?.name || "Unarmed"} Attack: <strong>Natural 1 - Automatic Failure!</strong>`,
        rolls: [roll]
      });
    }

    // No target: just show the attack roll
    if (!targetActor) {
      await this.consumeAtR(weaponSkill, 1);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weapon?.name || "Unarmed"} Attack: ${attackTotal}${isNat20 ? " (Natural 20!)" : ""}`,
        rolls: [roll]
      });
    }

    // Get defender's tDEF
    const defenderTDEF = targetActor.system?.defense?.tDEF || 4;

    // GATE A: does the attack fail immediately?
    if (attackTotal <= defenderTDEF) {
      await this.consumeAtR(weaponSkill, 1);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weapon?.name || "Unarmed"} Attack: ${attackTotal} vs tDEF ${defenderTDEF} - <strong>Attack Failed (Gate A)</strong>`,
        rolls: [roll]
      });
    }

    // Attack passed Gate A - prompt defender for Dodge or Defend
    if (targetActor.isOwner) {
      const defenseChoice = await this._promptDefenseChoice(targetActor);
      if (!defenseChoice) {
        await this.consumeAtR(weaponSkill, 1);
        return;
      }
      return this._resolveDefense(weapon, targetActor, attackTotal, isNat20, defenseChoice);
    }

    // NPC or non-owned actor - auto-choose defend
    return this._resolveDefense(weapon, targetActor, attackTotal, isNat20, "defend");
  }

  /**
   * Prompt defender to choose Dodge or Defend.
   * @returns {Promise<string|null>} "dodge", "defend", or null if cancelled.
   */
  async _promptDefenseChoice(defender) {
    const content = `
      <div class="form-group">
        <label>Choose your defense:</label>
        <select name="defenseType" autofocus>
          <option value="dodge">Dodge (${defender.system.combat?.dodgeBonus || 0} bonus)</option>
          <option value="defend">Defend (${defender.system.combat?.defendBonus || 0} bonus)</option>
        </select>
      </div>`;

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: `${defender.name} - Choose Defense` },
      content,
      buttons: [
        {
          action: "roll",
          label: "Roll Defense",
          default: true,
          callback: (event, button) => button.form.elements.defenseType.value
        },
        {
          action: "cancel",
          label: "Cancel"
        }
      ],
      rejectClose: false
    });

    return (choice && choice !== "cancel") ? choice : null;
  }

  /** Resolve defense roll and determine hit/miss. */
  async _resolveDefense(weapon, defender, attackTotal, isNat20Attack, defenseType) {
    const defenderBonus = defenseType === "dodge"
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

    // Apply halfDefenseFlag if set. Half Rolls halve the NATURAL die roll
    // (rounding halves up) BEFORE adding Bonuses (Genesis Ch1, "Half Rolls").
    let finalDefenseTotal = defenseTotal;
    let halfRollApplied = false;
    if (defender.system.combat?.halfDefenseFlag) {
      const halvedDie = Math.ceil((natRollDefense ?? 0) / 2);
      finalDefenseTotal = halvedDie + defenderBonus;
      halfRollApplied = true;
      await defender.update({ "system.combat.halfDefenseFlag": false });
    }

    const weaponSkill = weapon?.system?.weaponSkill || "lightArms";

    // Nat 20 Defense: automatic success + free attack
    if (isNat20Defense) {
      await this.consumeAtR(weaponSkill, 1);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} rolled <strong>Natural 20 Defense!</strong> Attack blocked. Free counter-attack granted.`,
        rolls: [defenseRoll]
      });
      // TODO: Trigger free attack (would need to be handled by combat system)
      return;
    }

    // Nat 1 Defense: automatic failure, 1.5x damage
    if (isNat1Defense) {
      await this.consumeAtR(weaponSkill, 1);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} rolled <strong>Natural 1 Defense!</strong> Automatic failure. Damage will be ×1.5.`,
        rolls: [defenseRoll]
      });
      return this._resolveDamage(weapon, defender, attackTotal, isNat20Attack, true, true);
    }

    // Normal defense resolution: ties go to defender
    const attackHits = finalDefenseTotal < attackTotal;
    await this.consumeAtR(weaponSkill, 1);

    let flavor = `${weapon?.name || "Unarmed"} Attack: ${attackTotal} vs ${defenseType.capitalize()} ${finalDefenseTotal}`;
    if (halfRollApplied) flavor += " (Half Roll)";
    flavor += attackHits ? " - <strong>Hit!</strong>" : " - <strong>Defended!</strong>";
    if (!attackHits) {
      // AtR is only lost by attacking or by taking Damage - a successful
      // defense costs the defender nothing (Genesis Ch5, "AtR").
      flavor += `<br><em>${defender.name} may make a return attack if they have AtR remaining.</em>`;
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [defenseRoll]
    });

    if (attackHits) {
      return this._resolveDamage(weapon, defender, attackTotal, isNat20Attack, false, false);
    }
  }

  /** Resolve damage and apply armor degradation. */
  async _resolveDamage(weapon, defender, attackTotal, isNat20Attack, isNat1Defense, isNat20Defense) {
    const damageFormula = weapon?.system?.damage || "1d4";
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
    const hitAP = "chest"; // Could be randomized or chosen

    // Apply armor degradation
    await this._applyArmorDegradation(defender, hitAP, finalDamage);

    // Apply damage to life. Life can go negative down to the character's
    // negative maximum (coma range - Genesis Ch3, "Death and Comas").
    const currentLife = defender.system.life?.value || 0;
    const maxLife = defender.system.life?.max || 0;
    const newLife = Math.max(-maxLife, currentLife - finalDamage);
    await defender.update({ "system.life.value": newLife });
    if ((newLife <= 0) && (currentLife > 0)) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `<strong>${defender.name} has fallen to ${newLife} Life!</strong> Roll a Save vs. Death (DF ${defender.system.saves?.death?.df ?? 11}) - success means a coma (lose 1 Life/hour to -${maxLife}), failure means death.`
      });
    }

    // Consume AtR from damage
    if (defender && typeof defender._consumeAtRFromDamage === "function") {
      await defender._consumeAtRFromDamage();
    }

    const flavor = `${weapon?.name || "Unarmed"} Damage: ${finalDamage} (${damageRoll.total}`
      + `${isNat20Attack ? " ×2" : ""}${isNat1Defense ? " ×1.5" : ""}`
      + `${damageBonus > 0 ? ` + ${damageBonus}` : ""})`;

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [damageRoll]
    });
  }

  /** Apply armor degradation based on the CAP system. */
  async _applyArmorDegradation(defender, hitAP, damageAmount) {
    const equippedArmor = defender.items.filter(item =>
      item.type === "armor" &&
      item.system.equipped === true &&
      item.system.ap === hitAP
    );
    if (equippedArmor.length === 0) return;

    // Use the armor piece with highest aDEF (should only be one per slot due to stacking)
    const armor = equippedArmor[0];
    const cap = armor.system.CAP || 0;
    if (cap <= 0 || damageAmount < cap) return;

    // CAP is how much Damage the piece can take FROM A SINGLE BLOW before its
    // aDEF is reduced by one (-1); once aDEF is +0, further qualifying blows
    // reduce PEN by one instead (Genesis Ch9). One step per blow.
    let currentADEF = (armor.system.currentADEF !== undefined) ? armor.system.currentADEF : armor.system.aDEF;
    let currentPEN = (armor.system.currentPEN !== undefined) ? armor.system.currentPEN : armor.system.PEN;

    if (currentADEF > 0) currentADEF -= 1;
    else if (currentPEN > 0) currentPEN -= 1;

    await armor.update({
      "system.currentADEF": currentADEF,
      "system.currentPEN": currentPEN
    });
    // Defense totals recompute automatically in prepareDerivedData after the update.
  }

  /**
   * Roll damage (manual damage rolls from the sheet).
   * Shift-click = Natural-20 Double Damage: per the general rule (Genesis
   * Ch5, "Modifying Damage") the Natural dice are multiplied FIRST and
   * Damage Bonuses added after. (The Advanced-Combat Critical strike, which
   * adds the Bonus before multiplying and spends multiple AtR, is a separate
   * action and not this button.)
   */
  async rollDamage(weapon, isDouble = false) {
    let damageFormula = weapon?.system?.damage || "1d4";
    const damageBonus = this.system.combat?.damageBonus || 0;

    if (isDouble) {
      damageFormula = `(${damageFormula}) * 2`;
    }
    damageFormula += ` + ${damageBonus}`;

    const roll = new Roll(damageFormula);
    await roll.evaluate();

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${weapon?.name || "Unarmed"} Damage${isDouble ? " (Double Damage - Nat 20)" : ""}`,
      rolls: [roll]
    });
  }
}
