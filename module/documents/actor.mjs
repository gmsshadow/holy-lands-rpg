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
  /*  Combat State Flags                          */
  /* -------------------------------------------- */

  /**
   * Round-scoped combat state, stored as flags:
   * - advNat20:  +3 to Attack/Critical/Special (Natural 20 Advantage) until
   *              end of Round or this actor takes Damage.
   * - advNat1:   -3 to Dodge/Defend (Natural 1 Advantage) until end of Round
   *              or this actor successfully hits an opponent.
   * - forfeitAdvantage: next defensive action this Round rolls double Bonus.
   * - retreating: declared Retreat - must Dodge; success ends the threat for
   *              the Round.
   * (Genesis Ch5: "Advantage", "Retreat")
   */
  getCombatFlag(key) {
    return this.getFlag("holy-lands-rpg", key) ?? false;
  }

  async setCombatFlag(key, value) {
    if (value) return this.setFlag("holy-lands-rpg", key, true);
    if (this.getFlag("holy-lands-rpg", key) !== undefined) {
      return this.unsetFlag("holy-lands-rpg", key);
    }
  }

  /** Clear all round-scoped combat flags (start of each Round). */
  async clearRoundCombatFlags() {
    for (const key of ["advNat20", "advNat1", "forfeitAdvantage", "retreating"]) {
      await this.setCombatFlag(key, false);
    }
  }

  /** Forfeit Advantage: double the next Dodge/Defend Bonus this Round. */
  async forfeitAdvantage() {
    await this.setCombatFlag("forfeitAdvantage", true);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} forfeits Advantage</strong> to better prepare - their next Dodge or Defend this Round rolls with double Bonus.`
    });
  }

  /**
   * Declare a Retreat: forfeit Advantage (2x Dodge) and any attacks this
   * Round; a successful Dodge of the initial Attack puts the character out
   * of harm's way. Pride/Control/Strife characters must first Save vs. Sin.
   */
  async declareRetreat() {
    const sins = this.system.sins ?? [];
    const blocking = sins.filter(x => /pride|control|strife/i.test(String(x)));
    let sinNote = "";
    if (blocking.length) {
      sinNote = `<br><em>Has the Sin${blocking.length > 1 ? "s" : ""} of ${blocking.join(", ")}: must first Save vs. Sin (DF ${this.system.saves?.sin?.df ?? 10}), and if successful, Retreats at Half Rolls.</em>`;
    }
    await this.setCombatFlag("forfeitAdvantage", true);
    await this.setCombatFlag("retreating", true);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} declares a Retreat!</strong> They forfeit Advantage and all attacks this Round (2x Dodge Bonus), and must successfully Dodge the initial Attack to break away.${sinNote}`
    });
  }

  /** The first equipped weapon (used for return attacks and counters). */
  getEquippedWeapon() {
    return this.items.find(i => (i.type === "weapon") && i.system.equipped) ?? null;
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

  /**
   * Roll an attack against a target.
   * @param {Item|null} weapon      The weapon used (null = unarmed).
   * @param {Actor|null} targetActor
   * @param {object} [options]
   * @param {"attack"|"critical"|"special"} [options.mode="attack"]
   * @param {number} [options.multiplier=1]  Critical Damage multiplier (= AtR spent).
   * @param {number} [options.modifier=0]    Situational modifier (Flanking, Rac bonuses).
   * @param {boolean} [options.free=false]   Free attack: costs no AtR and is exempt
   *                                         from all Natural 20/1 riders (Ch5).
   */
  async rollAttack(weapon, targetActor = null, options = {}) {
    const { mode = "attack", multiplier = 1, modifier = 0, free = false } = options;

    const weaponSkill = weapon?.system?.weaponSkill || "lightArms";
    const ws = this.system.weaponSkills?.[weaponSkill];
    if (!ws) {
      ui.notifications.error(`Weapon skill ${weaponSkill} not found`);
      return;
    }

    if (this.getCombatFlag("retreating")) {
      ui.notifications.warn(`${this.name} has declared a Retreat and forfeits all attacks this Round.`);
      return;
    }

    // AtR cost: Critical strikes spend AtR equal to their multiplier (Ch5).
    const atrCost = free ? 0 : (mode === "critical" ? Math.max(2, multiplier) : 1);
    const atr = this.getAtR(weaponSkill);
    if (!free && (atr.current < atrCost)) {
      ui.notifications.warn(`Not enough AtR for ${ws.label} (${atrCost} needed, ${atr.current} remaining)`);
      return;
    }

    // Select the attack-action Bonus by mode. The Critical Bonus can never
    // exceed the Attack Bonus of the same Weapon Skill (Ch5).
    const attackBonus = ws.attackBonus || 0;
    let actionBonus = attackBonus;
    let modeLabel = "";
    if (mode === "critical") {
      actionBonus = Math.min(ws.criticalBonus || 0, attackBonus);
      if ((ws.criticalBonus || 0) > attackBonus) {
        ui.notifications.warn(`${ws.label}: Critical Bonus capped at the Attack Bonus (${attackBonus}).`);
      }
      modeLabel = ` (Critical x${multiplier})`;
    }
    else if (mode === "special") {
      actionBonus = ws.specialBonus || 0;
      modeLabel = " (Special)";
    }

    // Natural 20 Advantage: +3 to Attack, Critical, and Special this Round.
    const advBonus = this.getCombatFlag("advNat20") ? 3 : 0;
    const totalBonus = actionBonus + advBonus + (modifier || 0);

    const roll = new Roll("1d20 + @bonus", { bonus: totalBonus });
    await roll.evaluate();

    const attackTotal = roll.total;
    let natRoll = null;
    for (const term of roll.terms) {
      if (term.results?.length) { natRoll = term.results[0].result; break; }
    }
    const isNat20 = !free && (natRoll === 20);
    const isNat1 = natRoll === 1;

    const bonusNote = advBonus ? " [+3 Advantage]" : "";
    const weaponName = weapon?.name || "Unarmed";

    // Natural 1: never successful. Outside free attacks, the attacker is off
    // balance: next defensive action is a Half Roll (Ch5).
    if (isNat1) {
      if (!free) {
        await this.update({ "system.combat.halfDefenseFlag": true });
        await this.consumeAtR(weaponSkill, atrCost);
      }
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weaponName}${modeLabel} Attack: <strong>Natural 1 - Automatic Failure!</strong>${free ? "" : " Next defensive action is a Half Roll."}`,
        rolls: [roll]
      });
    }

    // No target: just show the attack roll.
    if (!targetActor) {
      await this.consumeAtR(weaponSkill, atrCost);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weaponName}${modeLabel} Attack: ${attackTotal}${bonusNote}${isNat20 ? " (Natural 20!)" : ""}`,
        rolls: [roll]
      });
    }

    // GATE A: the attack must exceed the defender's tDEF.
    const defenderTDEF = targetActor.system?.defense?.tDEF || 4;
    if (!isNat20 && (attackTotal <= defenderTDEF)) {
      await this.consumeAtR(weaponSkill, atrCost);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weaponName}${modeLabel} Attack: ${attackTotal}${bonusNote} vs tDEF ${defenderTDEF} - <strong>Attack Failed (armor holds)</strong>`,
        rolls: [roll]
      });
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${weaponName}${modeLabel} Attack: ${attackTotal}${bonusNote}${isNat20 ? " <strong>(Natural 20!)</strong>" : ""} vs tDEF ${defenderTDEF} - beats armor, ${targetActor.name} must Dodge or Defend!`,
      rolls: [roll]
    });

    const attackContext = {
      attackTotal, isNat20, mode, multiplier, free,
      atrCost, weaponSkill
    };

    // Prompt defender for Dodge or Defend (forced Dodge while Retreating).
    let defenseChoice = "defend";
    if (targetActor.getCombatFlag("retreating")) {
      defenseChoice = "dodge";
    }
    else if (targetActor.isOwner) {
      defenseChoice = await this._promptDefenseChoice(targetActor);
      if (!defenseChoice) {
        await this.consumeAtR(weaponSkill, atrCost);
        return;
      }
    }

    return this._resolveDefense(weapon, targetActor, attackContext, defenseChoice);
  }

  /**
   * Prompt defender to choose Dodge or Defend.
   * @returns {Promise<string|null>} "dodge", "defend", or null if cancelled.
   */
  async _promptDefenseChoice(defender) {
    const notes = [];
    if (defender.getCombatFlag("forfeitAdvantage")) notes.push("Forfeited Advantage: this defense rolls DOUBLE Bonus");
    if (defender.getCombatFlag("advNat1")) notes.push("Natural 1 Advantage: -3 to this defense");
    if (defender.system.combat?.halfDefenseFlag) notes.push("Off balance: this defense is a Half Roll");
    const noteHtml = notes.length ? `<p><em>${notes.join("<br>")}</em></p>` : "";

    const content = `
      ${noteHtml}
      <div class="form-group">
        <label>Choose your defense:</label>
        <select name="defenseType" autofocus>
          <option value="dodge">Dodge (+${defender.system.combat?.dodgeBonus || 0})</option>
          <option value="defend">Defend (+${defender.system.combat?.defendBonus || 0})</option>
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
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });

    return (choice && choice !== "cancel") ? choice : null;
  }

  /** Resolve defense roll and determine hit/miss. */
  async _resolveDefense(weapon, defender, attackContext, defenseType) {
    const { attackTotal, isNat20: isNat20Attack, free, atrCost, weaponSkill } = attackContext;

    // Assemble the defender's Bonus:
    // base -> x2 if Advantage was forfeited -> -3 if Natural 1 Advantage.
    let defenderBonus = defenseType === "dodge"
      ? (defender.system.combat?.dodgeBonus || 0)
      : (defender.system.combat?.defendBonus || 0);
    const notes = [];
    if (defender.getCombatFlag("forfeitAdvantage")) {
      defenderBonus *= 2;
      notes.push("2x Bonus (forfeited Advantage)");
      await defender.setCombatFlag("forfeitAdvantage", false);
    }
    if (defender.getCombatFlag("advNat1")) {
      defenderBonus -= 3;
      notes.push("-3 (Natural 1 Advantage)");
    }

    const defenseRoll = new Roll("1d20 + @bonus", { bonus: defenderBonus });
    await defenseRoll.evaluate();

    let natRollDefense = null;
    for (const term of defenseRoll.terms) {
      if (term.results?.length) { natRollDefense = term.results[0].result; break; }
    }
    // Free attacks are exempt from all Natural 20/1 riders on BOTH sides (Ch5).
    const isNat20Defense = !free && (natRollDefense === 20);
    const isNat1Defense = !free && (natRollDefense === 1);

    // Half Roll: halve the NATURAL die (round up) before adding Bonuses (Ch1).
    let finalDefenseTotal = defenseRoll.total;
    if (defender.system.combat?.halfDefenseFlag) {
      finalDefenseTotal = Math.ceil((natRollDefense ?? 0) / 2) + defenderBonus;
      notes.push("Half Roll");
      await defender.update({ "system.combat.halfDefenseFlag": false });
    }
    const noteText = notes.length ? ` (${notes.join(", ")})` : "";

    // Natural 20 Defense: always successful + a free counter-attack that
    // costs no AtR and is exempt from further Benefit/Penalty riders.
    if (isNat20Defense) {
      await this.consumeAtR(weaponSkill, atrCost);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} rolled a <strong>Natural 20 ${defenseType.capitalize()}!</strong> The attack is stopped and ${defender.name} gains a free counter-attack (no AtR).`,
        rolls: [defenseRoll]
      });
      return this._offerCounterAttack(defender, this, { free: true });
    }

    // Natural 1 Defense: automatic failure, 1.5x Damage.
    if (isNat1Defense) {
      await this.consumeAtR(weaponSkill, atrCost);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} rolled a <strong>Natural 1 ${defenseType.capitalize()}!</strong> Automatic failure - Damage will be x1.5.`,
        rolls: [defenseRoll]
      });
      return this._resolveDamage(weapon, defender, { ...attackContext, isNat1Defense: true });
    }

    // Normal resolution: ALL ties go to the defender (Ch5). A Natural 20
    // Attack is always successful unless the defender also rolled a Natural
    // 20 (handled above - the tie goes to the defender).
    const attackHits = attackContext.isNat20 || (finalDefenseTotal < attackTotal);
    await this.consumeAtR(weaponSkill, atrCost);

    let flavor = `${weapon?.name || "Unarmed"} Attack ${attackTotal} vs ${defenseType.capitalize()} ${finalDefenseTotal}${noteText}`;
    flavor += attackHits ? " - <strong>Hit!</strong>" : " - <strong>Defended!</strong>";

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor,
      rolls: [defenseRoll]
    });

    // Retreat: a successful Dodge of the initial Attack breaks away.
    if (!attackHits && defender.getCombatFlag("retreating") && (defenseType === "dodge")) {
      await defender.setCombatFlag("retreating", false);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `<strong>${defender.name} successfully Retreats</strong> - out of harm's way from ${this.name} for the Round.`
      });
      return;
    }

    if (attackHits) {
      return this._resolveDamage(weapon, defender, attackContext);
    }

    // Successful defense costs nothing - and the defender may return attack
    // immediately if they have AtR remaining (Ch5, "Return Attack").
    if (!free) return this._offerCounterAttack(defender, this, { free: false });
  }

  /**
   * Offer the defender a counter/return attack against the attacker.
   * @param {Actor} defender  The successful defender who may strike back.
   * @param {Actor} attacker  The original attacker (now the target).
   * @param {object} options  { free } - free counters cost no AtR and carry
   *                          no Natural riders; return attacks are normal.
   */
  async _offerCounterAttack(defender, attacker, { free = false } = {}) {
    const counterWeapon = defender.getEquippedWeapon();
    const wsKey = counterWeapon?.system?.weaponSkill || "lightArms";

    // Return attacks (not free) require AtR remaining.
    if (!free) {
      const atr = defender.getAtR(wsKey);
      if (!defender.system.weaponSkills || (atr.current < 1)) {
        return ChatMessage.create({
          speaker: ChatMessage.getSpeaker({ actor: defender }),
          flavor: `${defender.name} has no AtR remaining for a return attack.`
        });
      }
    }

    const kind = free ? "free counter-attack" : "return attack";
    if (!defender.isOwner || !defender.system.weaponSkills) {
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} may make a ${kind} against ${attacker.name}${free ? " (no AtR cost)" : ""}.`
      });
    }

    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: { title: `${defender.name} - ${kind.capitalize()}` },
      content: `<p>Make a ${kind} against <strong>${attacker.name}</strong> with <strong>${counterWeapon?.name || "Unarmed"}</strong>${free ? " (no AtR cost, no critical effects)" : ""}?</p>`,
      rejectClose: false
    });
    if (!proceed) return;

    return defender.rollAttack(counterWeapon, attacker, { free });
  }

  /** Resolve damage and apply armor degradation. */
  async _resolveDamage(weapon, defender, attackContext) {
    const { isNat20Attack = false, isNat1Defense = false, mode = "attack", multiplier = 1 } = {
      isNat20Attack: attackContext.isNat20,
      isNat1Defense: attackContext.isNat1Defense ?? false,
      mode: attackContext.mode,
      multiplier: attackContext.multiplier
    };
    const damageFormula = weapon?.system?.damage || "1d4";
    const damageBonus = this.system.combat?.damageBonus || 0;

    const damageRoll = new Roll(damageFormula);
    await damageRoll.evaluate();

    let finalDamage;
    const parts = [`${damageRoll.total}`];
    if (mode === "critical") {
      // Critical strikes are the ONE exception: add the Damage Bonus BEFORE
      // multiplying (Ch5, "Critical" / "Modifying Damage").
      finalDamage = (damageRoll.total + damageBonus) * Math.max(2, multiplier);
      parts.length = 0;
      parts.push(`(${damageRoll.total}${damageBonus ? ` + ${damageBonus}` : ""}) x${Math.max(2, multiplier)}`);
    }
    else {
      finalDamage = damageRoll.total;
      if (isNat20Attack) { finalDamage *= 2; parts.push("x2 (Nat 20)"); }
      if (isNat1Defense) { finalDamage = Math.floor(finalDamage * 1.5); parts.push("x1.5 (Nat 1 defense)"); }
      finalDamage += damageBonus;
      if (damageBonus) parts.push(`+ ${damageBonus}`);
    }

    // Landing a hit clears this actor's Natural 1 Advantage penalty (Ch5).
    if (this.getCombatFlag("advNat1")) await this.setCombatFlag("advNat1", false);

    // Determine hit location (default: chest)
    const hitAP = "chest";

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

    // Taking Damage costs the defender 1 AtR and ends their Nat 20 Advantage.
    if (typeof defender._consumeAtRFromDamage === "function") {
      await defender._consumeAtRFromDamage();
    }
    if (defender.getCombatFlag("advNat20")) await defender.setCombatFlag("advNat20", false);

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${weapon?.name || "Unarmed"} Damage: <strong>${finalDamage}</strong> (${parts.join(" ")})`,
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
