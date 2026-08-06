/**
 * Extend the base Actor document for Holy Lands RPG.
 *
 * Data preparation now lives on the type data models (module/data/), so this
 * class is responsible for rolls, the attack/defense pipeline and AtR
 * management only.
 */
import { CLASS_BLESSING_TABLE, blessingFromRoll } from "../data/blessing-tables.mjs";

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

  /**
   * Spend AtR for an action. In Holy Lands RPG a character's AtR is a single
   * pool of "actions this Round" shared across all Weapon Skills - switching
   * weapons must not grant extra attacks. So an action decrements EVERY
   * Weapon Skill's AtR by the action's cost (floored at 0), not just the one
   * used. A Critical costs more (equal to its multiplier), and because it
   * represents pouring the whole Round's focus into one blow, that full cost
   * is taken from all pools too (Combat Handbook, Section 7).
   * @param {number} cost  AtR cost of the action (1 for a normal attack, N
   *                       for an xN Critical).
   */
  async spendActionAtR(cost = 1) {
    const weaponSkills = this.system.weaponSkills;
    if (!weaponSkills) return;
    const update = {};
    for (const [key, skill] of Object.entries(weaponSkills)) {
      if (skill.atRCurrent === undefined) continue;
      update[`system.weaponSkills.${key}.atRCurrent`] = Math.max(0, (skill.atRCurrent || 0) - cost);
    }
    if (Object.keys(update).length) await this.update(update);
  }

  /** When taking damage, one action-beat is lost: every AtR pool drops by 1. */
  async _consumeAtRFromDamage() {
    return this.spendActionAtR(1);
  }

  /** Total AtR remaining on the ACTIVE weapon skill (what the sheet shows). */
  get activeAtR() {
    const key = this.system.activeWeaponSkill || "lightArms";
    const skill = this.system.weaponSkills?.[key];
    return {
      key,
      label: skill?.label || key,
      current: skill?.atRCurrent ?? 0,
      max: skill?.atRMax ?? 0
    };
  }

  /** Set the active weapon skill (the attack type currently in use). */
  async setActiveWeaponSkill(key) {
    if (!this.system.weaponSkills?.[key]) return;
    await this.update({ "system.activeWeaponSkill": key });
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
    // Forget which Weapon Skill opened the Round (p.51 switch rule).
    if (this.getFlag("holy-lands-rpg", "roundWeaponSkill") !== undefined) {
      await this.unsetFlag("holy-lands-rpg", "roundWeaponSkill");
    }
  }

  /**
   * The Weapon Skill this actor first attacked with this Round, or null if
   * they haven't attacked yet. Used to enforce the p.51 rule that switching
   * to a different Weapon Skill mid-Round must be rolled as a Special.
   */
  get roundWeaponSkill() {
    return this.getFlag("holy-lands-rpg", "roundWeaponSkill") ?? null;
  }

  async setRoundWeaponSkill(key) {
    return this.setFlag("holy-lands-rpg", "roundWeaponSkill", key);
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

  /** Damage formula for a weapon as wielded by this actor's stature. */
  weaponDamageFormula(weapon) {
    // Synthetic innate attacks (Punch/Kick) carry their own resolved damage.
    if (weapon?.innateDamage) return weapon.innateDamage;
    const fallback = weapon?.system?.damage || "1d4";
    if (!weapon || (weapon.type !== "weapon")) return fallback;
    const stature = (this.type === "character") ? this.system.stature : "commonFolk";
    return weapon.system.damageForStature?.(stature) || fallback;
  }

  /** Whether the actor has a Skill item mapped to the given Weapon Skill key. */
  hasWeaponSkill(weaponSkillKey) {
    return this.items.some(i =>
      (i.type === "skill") && (i.system.weaponSkillKey === weaponSkillKey));
  }

  /**
   * Unarmed attack damage (Genesis p.48). Depends on Stature AND whether the
   * character has the relevant Weapon Skill:
   *   Punching             1d2 [wee 1 | giant 1d3]
   *   Punching w/ WS H2H   1d4 [wee 1d2 | giant 1d6]
   *   Kicking              1d3 [wee 1d2 | giant 1d4]
   *   Kicking w/ WS Kick   1d6 [wee 1d4 | giant 1d8]
   * @param {"punch"|"kick"} kind
   */
  static UNARMED_DAMAGE = {
    punch: {
      untrained: { commonFolk: "1d2", dwarfFolk: "1d2", weeFolk: "1",   giantFolk: "1d3" },
      trained:   { commonFolk: "1d4", dwarfFolk: "1d4", weeFolk: "1d2", giantFolk: "1d6" }
    },
    kick: {
      untrained: { commonFolk: "1d3", dwarfFolk: "1d3", weeFolk: "1d2", giantFolk: "1d4" },
      trained:   { commonFolk: "1d6", dwarfFolk: "1d6", weeFolk: "1d4", giantFolk: "1d8" }
    }
  };

  unarmedDamageFormula(kind) {
    const stature = (this.type === "character") ? this.system.stature : "commonFolk";
    const wsKey = (kind === "kick") ? "kickAttack" : "handToHand";
    const trained = this.hasWeaponSkill(wsKey) ? "trained" : "untrained";
    const table = this.constructor.UNARMED_DAMAGE[kind]?.[trained];
    return table?.[stature] || table?.commonFolk || "1d2";
  }

  /**
   * The character's innate unarmed attacks (Punch, Kick) as virtual "weapon"
   * entries for the Ready Weapons block. These are always available and can't
   * be deleted; damage follows Stature and Weapon Skill possession (p.48).
   */
  get innateAttacks() {
    const build = (kind, label, wsKey, img) => ({
      innate: true, kind, id: `innate-${kind}`,
      name: label,
      img,
      weaponSkill: wsKey,
      displayDamage: this.unarmedDamageFormula(kind),
      trained: this.hasWeaponSkill(wsKey)
    });
    return [
      build("punch", "Punch (unarmed)", "handToHand", "icons/svg/combat.svg"),
      build("kick", "Kick (unarmed)", "kickAttack", "icons/svg/combat.svg")
    ];
  }

  /** The character's Class item, if one has been dropped on the sheet. */
  get classItem() {
    return this.items.find(i => i.type === "class") ?? null;
  }

  /** Build a synthetic weapon-like object for an innate attack (Punch/Kick). */
  #innateWeapon(kind) {
    const wsKey = (kind === "kick") ? "kickAttack" : "handToHand";
    const label = (kind === "kick") ? "Kick (unarmed)" : "Punch (unarmed)";
    return {
      innate: true,
      name: label,
      system: { weaponSkill: wsKey },
      innateDamage: this.unarmedDamageFormula(kind)
    };
  }

  /** Roll an unarmed attack (p.48) through the normal attack pipeline. */
  async rollUnarmedAttack(kind, targetActor = null, options = {}) {
    return this.rollAttack(this.#innateWeapon(kind), targetActor, options);
  }

  /** Roll unarmed damage directly (Stature + Weapon Skill dependent). */
  async rollUnarmedDamage(kind) {
    const formula = this.constructor.graceFormula(this.unarmedDamageFormula(kind));
    const dam = this.system.combat?.damageBonus || 0;
    const roll = new Roll(`${formula} + @dam`, { dam });
    await roll.evaluate();
    const label = (kind === "kick") ? "Kick" : "Punch";
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${this.name} - ${label} Damage (${this.hasWeaponSkill(kind === "kick" ? "kickAttack" : "handToHand") ? "trained" : "untrained"})`
    });
  }

  /** Apply the Grace Effect reroll modifier to a die formula if enabled. */
  static graceFormula(formula) {
    if (!game.settings.get("holy-lands-rpg", "graceEffect")) return formula;
    return String(formula).replace(/(\d*)d(\d+)/gi, "$&rr1");
  }

  /**
   * Step 2 (Genesis p.53): roll all twelve Attributes using the Stature's
   * dice table (Grace Effect per world setting), assign the AVs, and lock
   * creation so the roll cannot be repeated.
   */
  async rollCreationAttributes() {
    if (this.type !== "character") return;
    if (this.system.creation?.attributesRolled) {
      ui.notifications.warn("Attributes have already been rolled for this character.");
      return;
    }
    const stature = this.system.stature;
    const table = this.system.constructor.STATURE_ATTRIBUTE_DICE?.[stature];
    if (!table) {
      ui.notifications.error(`No attribute dice table for stature "${stature}".`);
      return;
    }

    const update = { "system.creation.attributesRolled": true };
    const rolls = [];
    const lines = [];
    for (const [key, dice] of Object.entries(table)) {
      const roll = new Roll(this.constructor.graceFormula(dice));
      await roll.evaluate();
      rolls.push(roll);
      update[`system.attributes.${key}.value`] = roll.total;
      const label = this.system.attributes[key]?.label ?? key;
      lines.push(`${label}: ${dice}(GE) = <strong>${roll.total}</strong>`);
    }
    await this.update(update);

    const statureLabel = stature.charAt(0).toUpperCase() + stature.slice(1);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Attribute Generation (${statureLabel})</strong><br>`
        + lines.join("<br>")
        + `<br><em>Step 2A: if the class's Primary/Secondary Attribute requirements are not met, the Rac may allow rerolling those Attributes until they are. Stature and this roll are now locked.</em>`,
      rolls
    });
  }

  /**
   * Resolve the class Attribute requirements from the best available
   * source: (1) the class item's structured fields, (2) the class item's
   * requirements display text, (3) the built-in Ch7 table keyed by the
   * dropdown class. Returns [[attrKey, min], ...].
   */
  getClassRequirements() {
    if (this.type !== "character") return [];
    const cls = this.classItem;

    if (cls) {
      // (1) Structured fields
      const structured = [];
      for (const [attrKey, minKey] of [["primaryAttribute", "primaryMin"], ["secondaryAttribute", "secondaryMin"]]) {
        const key = cls.system[attrKey];
        const min = cls.system[minKey] || 0;
        if (key && (min > 0)) structured.push([key, min]);
      }
      if (structured.length) return structured;

      // (2) Parse the display text, e.g. "Charisma 10, Intellect 8"
      const LABELS = {
        intellect: "int", wisdom: "wis", patience: "pat", will: "will",
        memory: "mem", strength: "str", agility: "agi", speed: "spd",
        endurance: "end", beauty: "bty", charisma: "cha", virtue: "vir"
      };
      const parsed = [];
      const text = cls.system.requirements || "";
      for (const m of text.matchAll(/(intellect|wisdom|patience|will|memory|strength|agility|speed|endurance|beauty|charisma|virtue)\s*:?\s*(\d+)/gi)) {
        parsed.push([LABELS[m[1].toLowerCase()], Number(m[2])]);
      }
      if (parsed.length) return parsed;
    }

    // (3) Built-in table by class key
    return this.system.constructor.CLASS_REQUIREMENTS?.[this.system.class] ?? [];
  }

  /**
   * Class Attribute requirements not currently met (Step 2A).
   * @returns {Array<{key: string, label: string, min: number, current: number}>}
   */
  getUnmetClassRequirements() {
    const unmet = [];
    for (const [key, min] of this.getClassRequirements()) {
      const attr = this.system.attributes?.[key];
      if (attr && (attr.value < min)) {
        unmet.push({ key, label: attr.label, min, current: attr.value });
      }
    }
    return unmet;
  }

  /**
   * Step 2A (p.53): reroll the class's unmet Primary/Secondary Attributes,
   * using the Stature's dice, repeatedly until each requirement is met.
   */
  async rollStep2ARerolls() {
    if (!this.system.creation?.attributesRolled) {
      ui.notifications.warn("Roll attributes (Step 2) before applying Step 2A rerolls.");
      return;
    }
    const unmet = this.getUnmetClassRequirements();
    if (!unmet.length) {
      ui.notifications.info("All class Attribute requirements are already met.");
      return;
    }
    const table = this.system.constructor.STATURE_ATTRIBUTE_DICE?.[this.system.stature];
    if (!table) return;

    const update = {};
    const rolls = [];
    const lines = [];
    const CAP = 200;
    for (const req of unmet) {
      const dice = table[req.key];
      let attempts = 0;
      let finalRoll = null;
      do {
        finalRoll = new Roll(this.constructor.graceFormula(dice));
        await finalRoll.evaluate();
        attempts++;
      } while ((finalRoll.total < req.min) && (attempts < CAP));

      if (finalRoll.total < req.min) {
        lines.push(`${req.label}: could not reach ${req.min} with ${dice} - kept ${req.current}`);
        continue;
      }
      rolls.push(finalRoll);
      update[`system.attributes.${req.key}.value`] = finalRoll.total;
      lines.push(`${req.label}: ${req.current} → <strong>${finalRoll.total}</strong> (${dice}(GE), ${attempts} roll${attempts > 1 ? "s" : ""} to meet AV ${req.min})`);
    }
    if (!foundry.utils.isEmpty(update)) await this.update(update);

    // If starting Life/Faith were already rolled, recompute them from the
    // SAME stored die results with the new attribute values - the creation
    // roll itself is preserved; only the attribute portion updates.
    if (this.system.creation?.startingRolled) {
      const attrs = this.system.attributes;
      const cls = this.classItem;
      const lifeDie = this.system.creation.lifeDieResult || 0;
      const faithDie = this.system.creation.faithDieResult || 0;
      const faithAttrKeys = cls
        ? (cls.system.faithCreationAttrs ?? [])
        : (this.system.constructor.CLASS_FAITH_ATTRS?.[this.system.class] ?? []);
      const newLife = (attrs.str?.value || 0) + (attrs.end?.value || 0) + lifeDie;
      const newFaith = faithAttrKeys.reduce((sum, k) => sum + (attrs[k]?.value || 0), 0) + faithDie;
      const lifeChanged = newLife !== this.system.life.max;
      const faithChanged = newFaith !== this.system.faith.max;
      if (lifeChanged || faithChanged) {
        await this.update({
          "system.life.max": newLife, "system.life.value": newLife,
          "system.faith.max": newFaith, "system.faith.value": newFaith
        });
        lines.push(`<em>Starting Life/Faith recalculated with the original dice (Life die ${lifeDie}, Faith die ${faithDie}): Life <strong>${newLife}</strong>, Faith <strong>${newFaith}</strong></em>`);
      }
    }

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Step 2A: Class Attribute Rerolls (${this.classItem?.name ?? this.system.class})</strong><br>` + lines.join("<br>"),
      rolls
    });
  }

  /**
   * Apply a +1 Bonus to one Saving Throw (Step 4 at creation, and one per
   * level thereafter - p.54/p.62).
   */
  async applySaveBonus(saveKey, { creation = false } = {}) {
    const save = this.system.saves?.[saveKey];
    if (!save) return;
    if (creation && this.system.creation?.saveBonusChosen) {
      ui.notifications.warn("The creation Saving Throw Bonus has already been chosen.");
      return;
    }
    const update = { [`system.saves.${saveKey}.value`]: (save.value || 0) + 1 };
    if (creation) update["system.creation.saveBonusChosen"] = true;
    await this.update(update);

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name}</strong> adds +1 to <strong>Save vs. ${save.label}</strong> (now +${(save.value || 0) + 1})`
        + (creation ? " <em>- Step 4 creation Bonus (locked)</em>" : " <em>- level-up Bonus</em>")
    });
  }

  /**
   * Step 5 (pp.56-57): roll Height (d12 by Stature), look up Weight
   * (STR x height, males +10%), and roll Native Land and Language Group
   * (d20 each). All results remain editable afterwards.
   */
  async rollDetails() {
    if (this.type !== "character") return;
    const M = this.system.constructor;
    const stature = this.system.stature;
    const heights = M.HEIGHT_TABLE?.[stature];
    if (!heights) return;

    const heightRoll = new Roll("1d12");
    await heightRoll.evaluate();
    const height = heights[heightRoll.total - 1];

    // Weight lookup: parse height to inches, find the "less than" column.
    const m = height.match(/(\d+)'\s*(\d+)/);
    const inches = m ? (Number(m[1]) * 12 + Number(m[2])) : 66;
    let col = M.WEIGHT_THRESHOLDS_INCHES.findIndex(t => inches < t);
    if (col < 0) col = M.WEIGHT_THRESHOLDS_INCHES.length - 1;
    const str = Math.min(20, Math.max(2, this.system.attributes.str?.value ?? 9));
    let weight = M.WEIGHT_TABLE[str]?.[col] ?? 0;
    const male = (this.system.gender || "male") === "male";
    if (male) weight = Math.round(weight * 1.1);

    // Native Land and Language Group are one paired d20 table (p.57): a
    // single roll gives a land and its matching language group.
    const landRoll = new Roll("1d20");
    await landRoll.evaluate();
    const idx = landRoll.total - 1;
    const land = M.LANDS[idx];
    const lang = M.LANGUAGE_GROUPS[idx];

    await this.update({
      "system.height": height,
      "system.weight": `${weight} lbs`,
      "system.nativeLand": land,
      "system.languageGroup": lang
    });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Step 5 Details</strong><br>`
        + `Height (d12=${heightRoll.total}): <strong>${height}</strong><br>`
        + `Weight (STR ${str}, ${male ? "male +10%" : "female"}): <strong>${weight} lbs</strong><br>`
        + `Native Land &amp; Language (d20=${landRoll.total}): <strong>${land}</strong> - <strong>${lang}</strong><br>`
        + `<em>All of these can be edited on the sheet if you'd rather choose (you may mix land and language).</em>`,
      rolls: [heightRoll, landRoll]
    });
  }

  /**
   * Step 5 (p.56): roll Sins (by VIR) or Phobias (by WIL) - d20 per slot,
   * duplicates rerolled. Overwrites the current list; editable afterwards.
   * @param {"sins"|"phobias"} kind
   */
  async rollSinsOrPhobias(kind) {
    if (this.type !== "character") return;
    const M = this.system.constructor;
    const isSins = kind === "sins";
    const av = isSins ? (this.system.attributes.vir?.value ?? 9) : (this.system.attributes.will?.value ?? 9);
    const count = M.sinPhobiaCount(av);
    const table = isSins ? M.SINS : M.PHOBIAS;
    const label = isSins ? "Sins" : "Phobias";
    const attrLabel = isSins ? "VIR" : "WIL";

    if (count === 0) {
      await this.update({ [`system.${kind}`]: [] });
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `<strong>${this.name} - ${label}</strong>: ${attrLabel} ${av} grants <strong>none</strong> (AV 12+).`
      });
    }

    const results = [];
    const rolls = [];
    let guard = 0;
    while ((results.length < count) && (guard++ < 100)) {
      const roll = new Roll("1d20");
      await roll.evaluate();
      const entry = table[roll.total - 1];
      if (results.includes(entry)) continue; // reroll duplicates (p.56)
      results.push(entry);
      rolls.push(roll);
    }
    await this.update({ [`system.${kind}`]: results });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - ${label}</strong> (${attrLabel} ${av} → ${count}):<br>` + results.map(r => `• ${r}`).join("<br>"),
      rolls
    });
  }

  /**
   * Step 6 (p.58): grant the class's listed Gifts as skill items at +3 PF
   * (or +2 for Adventurer/Fighter, whose skills all start at +2). Matches
   * names against the Skills compendium so Weapon Skill / Combat Abilities
   * links come across; unmatched names are created as plain skills.
   */
  async grantClassGifts() {
    if (this.type !== "character") return;
    const cls = this.classItem;
    if (!cls) {
      ui.notifications.warn("Assign a Class before granting Gifts.");
      return;
    }
    if (this.system.creation?.giftsGranted) {
      ui.notifications.warn("Class Gifts have already been granted.");
      return;
    }

    const names = (cls.system.grantedGifts || "")
      .split("\n").map(x => x.trim()).filter(x => x.length);
    if (!names.length) {
      ui.notifications.warn(`${cls.name} has no Gifts listed to grant.`);
      return;
    }

    // Adventurer and Fighter: all Skills start at +2 (p.58).
    const basic = ["adventurer", "fighter"].includes(cls.system.key);
    const giftPF = basic ? 2 : 3;

    const pack = game.packs.get("holy-lands-rpg.skills");
    const packDocs = pack ? await pack.getDocuments() : [];
    const findInPack = name => packDocs.find(d => d.name.toLowerCase() === name.toLowerCase());

    const existing = new Set(this.items.filter(i => i.type === "skill").map(i => i.name.toLowerCase()));
    const toCreate = [];
    const skipped = [];
    for (const name of names) {
      if (existing.has(name.toLowerCase())) { skipped.push(name); continue; }
      const match = findInPack(name);
      const data = match
        ? foundry.utils.mergeObject(match.toObject(), { system: { skillType: "gift", pf: giftPF } })
        : { name, type: "skill", img: "icons/svg/book.svg", system: { skillType: "gift", pf: giftPF, weaponSkillKey: /^ws\s/i.test(name) ? "" : "", combatAbilities: /combat\s*abilit/i.test(name), isCombatSkill: /^cs\s/i.test(name) } };
      delete data._id;
      toCreate.push(data);
    }

    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
    await this.update({ "system.creation.giftsGranted": true });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Step 6: Class Gifts (${cls.name})</strong><br>`
        + `Granted at +${giftPF} PF: ${toCreate.map(t => t.name).join(", ") || "(none new)"}`
        + (skipped.length ? `<br><em>Already present: ${skipped.join(", ")}</em>` : "")
        + (basic ? `<br><em>${cls.name}: all Skills start at +2 (choose 7 Gifts, 5 Talents, 3 Crafts).</em>` : `<br><em>Now choose 5 Talents (+2) and 3 Crafts (+1) from the class's Skill list.</em>`),
      whisper: []
    });
  }

  /**
   * Add a skill from the Skills compendium into a given section at a set PF.
   * @param {string} compendiumSkillId
   * @param {"gift"|"talent"|"craft"} section
   * @param {number} pf
   */
  async addSkillFromCompendium(compendiumSkillId, section, pf) {
    const pack = game.packs.get("holy-lands-rpg.skills");
    if (!pack) return;
    const doc = await pack.getDocument(compendiumSkillId);
    if (!doc) return;
    const data = foundry.utils.mergeObject(doc.toObject(), { system: { skillType: section, pf } });
    delete data._id;
    return this.createEmbeddedDocuments("Item", [data]);
  }

  /**
   * Apply one Step 10 Attribute Bonus for the given attribute (p.60). The
   * effect depends on the attribute; RoH-flagged choices (Craft/Gift/Talent/
   * Save) prompt for which to raise. Increments the applied counter.
   */
  async applyAttributeBonus(attrKey, choiceKey = null) {
    if (this.type !== "character") return;
    const v = this.system.attrBonusValidation?.rows?.find(r => r.key === attrKey);
    if (!v || v.remaining <= 0) {
      ui.notifications.warn("No Attribute Bonus remaining for that Attribute.");
      return;
    }

    const update = {};
    const applied = foundry.utils.deepClone(this.system.creation?.attrBonusApplied ?? {});
    applied[attrKey] = (applied[attrKey] || 0) + 1;
    update["system.creation.attrBonusApplied"] = applied;

    let effectText = "";
    const rolls = [];

    switch (attrKey) {
      case "str":
        update["system.combat.damageBonus"] = (this.system.combat.damageBonus || 0) + 1;
        effectText = `Damage +1 (now +${update["system.combat.damageBonus"]})`;
        break;
      case "spd":
        update["system.combat.dodgeBonus"] = (this.system.combat.dodgeBonus || 0) + 1;
        effectText = `Dodge +1 (now +${update["system.combat.dodgeBonus"]})`;
        break;
      case "agi": {
        const wsKey = choiceKey || "lightArms";
        const ws = this.system.weaponSkills?.[wsKey];
        if (ws) {
          update[`system.weaponSkills.${wsKey}.atRMax`] = (ws.atRMax || 0) + 1;
          update[`system.weaponSkills.${wsKey}.atRCurrent`] = (ws.atRCurrent || 0) + 1;
          effectText = `${ws.label} AtR +1 (now ${update[`system.weaponSkills.${wsKey}.atRMax`]})`;
        }
        break;
      }
      case "pat": {
        const roll = new Roll(this.constructor.graceFormula("1d4"));
        await roll.evaluate(); rolls.push(roll);
        update["system.faith.max"] = (this.system.faith.max || 0) + roll.total;
        update["system.faith.value"] = (this.system.faith.value || 0) + roll.total;
        effectText = `Faith +${roll.total} (1d4 GE)`;
        break;
      }
      case "end": {
        const roll = new Roll(this.constructor.graceFormula("1d4"));
        await roll.evaluate(); rolls.push(roll);
        update["system.life.max"] = (this.system.life.max || 0) + roll.total;
        update["system.life.value"] = (this.system.life.value || 0) + roll.total;
        effectText = `Life +${roll.total} (1d4 GE)`;
        break;
      }
      case "bty":
      case "cha": {
        const roll = new Roll("2d4");
        await roll.evaluate(); rolls.push(roll);
        const gold = roll.total * 50;
        update["system.currency.gold"] = (this.system.currency.gold || 0) + gold;
        effectText = `+${gold}g (2d4 x 50)`;
        break;
      }
      case "will": {
        const saveKey = choiceKey;
        const save = this.system.saves?.[saveKey];
        if (save) {
          update[`system.saves.${saveKey}.value`] = (save.value || 0) + 1;
          effectText = `Save vs. ${save.label} +1 (now +${update[`system.saves.${saveKey}.value`]})`;
        }
        break;
      }
      case "int": case "wis": case "mem": {
        // Raise a chosen skill item's PF (Craft/Gift/Talent respectively).
        const skill = this.items.get(choiceKey);
        if (skill && (skill.type === "skill")) {
          await skill.update({ "system.pf": (skill.system.pf || 0) + 1 });
          effectText = `${skill.name} PF +1 (now +${(skill.system.pf || 0) + 1})`;
        }
        break;
      }
      case "vir": {
        const sins = foundry.utils.deepClone(this.system.sins ?? []);
        if (choiceKey !== null && choiceKey !== undefined && sins[choiceKey] !== undefined) {
          const removed = sins.splice(Number(choiceKey), 1);
          update["system.sins"] = sins;
          effectText = `lost the Sin of ${removed[0]}`;
        } else {
          effectText = "may lose one Sin (none selected)";
        }
        break;
      }
    }

    await this.update(update);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Attribute Bonus (${this.system.attributes[attrKey].label} ${this.system.attributes[attrKey].value})</strong>: ${effectText}`,
      rolls
    });
  }

  /** Whether this character's class grants Miracles (Saint or Cleric). */
  get miracleClass() {
    const key = this.classItem?.system.key ?? this.system.class;
    return (key === "saint") ? "saint" : (key === "cleric") ? "cleric" : null;
  }

  /** Add a Miracle from the compendium as an embedded item. */
  async addMiracleFromCompendium(compendiumId) {
    const pack = game.packs.get("holy-lands-rpg.miracles");
    if (!pack) return;
    const doc = await pack.getDocument(compendiumId);
    if (!doc) return;
    const data = doc.toObject();
    delete data._id;
    return this.createEmbeddedDocuments("Item", [data]);
  }

  /**
   * Cleric shortcut (p.60): grant ALL Level-1 Clerical Miracles at once
   * (the +1 High Miracle is chosen separately via the picker).
   */
  async grantClericClericalMiracles() {
    const pack = game.packs.get("holy-lands-rpg.miracles");
    if (!pack) return;
    const docs = await pack.getDocuments();
    const clerical = docs.filter(d => (d.system.miracleType === "clerical") && (d.system.level === 1));
    const have = new Set(this.items.filter(i => i.type === "miracle").map(i => i.name.toLowerCase()));
    const toCreate = clerical.filter(d => !have.has(d.name.toLowerCase())).map(d => {
      const o = d.toObject(); delete o._id; return o;
    });
    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name}</strong> gains all Level 1 Clerical Miracles: ${toCreate.map(t => t.name).join(", ") || "(already had them)"}. Now choose one (1) High Miracle.`
    });
  }

  /**
   * Step 9 (p.59): grant the class's starting kit as items, resolving each
   * entry against the compendia. Handles fixed items, dice-rolled
   * quantities, and 'or' options (resolved by the choices map). Skips
   * silently if already granted.
   * @param {object} choices  Map of entry index -> chosen option name (for
   *                          entries with options); absent = first option.
   */
  async grantStartingEquipment(choices = {}) {
    if (this.type !== "character") return;
    const cls = this.classItem;
    if (!cls) { ui.notifications.warn("Assign a Class first."); return; }
    if (this.system.creation?.equipmentGranted) {
      ui.notifications.warn("Starting equipment has already been granted.");
      return;
    }
    const kit = cls.system.startingKit ?? [];
    if (!kit.length) { ui.notifications.warn(`${cls.name} has no starting kit defined.`); return; }

    const packMap = {
      weapons: game.packs.get("holy-lands-rpg.weapons"),
      armor: game.packs.get("holy-lands-rpg.armor"),
      equipment: game.packs.get("holy-lands-rpg.equipment")
    };
    const docCache = {};
    const getDocs = async pk => {
      if (!pk) return [];
      if (!docCache[pk]) docCache[pk] = await packMap[pk]?.getDocuments() ?? [];
      return docCache[pk];
    };

    const toCreate = [];
    const rolls = [];
    const lines = [];
    const unmatched = [];

    for (let i = 0; i < kit.length; i++) {
      const entry = kit[i];
      // Resolve the chosen name (options -> player choice or first option).
      let name = entry.name;
      if (entry.options?.length) {
        name = choices[i] || entry.options[0];
      }

      // Which packs to search.
      const packsToSearch = entry.compendium ? [entry.compendium] : ["weapons", "armor", "equipment"];
      let match = null;
      for (const pk of packsToSearch) {
        const docs = await getDocs(pk);
        match = docs.find(d => d.name.toLowerCase() === name.toLowerCase())
          || docs.find(d => d.name.toLowerCase().includes(name.toLowerCase()));
        if (match) break;
      }
      if (!match) { unmatched.push(name); continue; }

      // Quantity: rolled or fixed.
      let qty = entry.qty || 1;
      if (entry.roll) {
        const r = new Roll(entry.roll);
        await r.evaluate();
        qty = Math.max(1, r.total);
        rolls.push(r);
      }

      const data = match.toObject();
      delete data._id;
      data.system = data.system || {};
      data.system.quantity = qty;
      toCreate.push(data);
      lines.push(`${qty > 1 ? qty + "x " : ""}${match.name}${entry.roll ? ` (${entry.roll})` : ""}`);
    }

    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);

    // Starting coinage (Genesis Ch7): roll gold and silver with Grace Effect.
    const goldRoll = new Roll(this.constructor.graceFormula(cls.system.coinGoldDie || "3d4"));
    await goldRoll.evaluate();
    const silverRoll = new Roll(this.constructor.graceFormula(cls.system.coinSilverDie || "1d4"));
    await silverRoll.evaluate();
    const gold = goldRoll.total * (cls.system.coinGoldMult || 10);
    const silver = silverRoll.total * (cls.system.coinSilverMult || 3);
    rolls.push(goldRoll, silverRoll);

    await this.update({
      "system.creation.equipmentGranted": true,
      "system.currency.gold": (this.system.currency?.gold || 0) + gold,
      "system.currency.silver": (this.system.currency?.silver || 0) + silver
    });
    lines.push(`Coinage: <strong>${gold}g</strong> (${cls.system.coinGoldDie} GE x ${cls.system.coinGoldMult}) and <strong>${silver}s</strong> (${cls.system.coinSilverDie} GE x ${cls.system.coinSilverMult})`);

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Step 9: Starting Equipment (${cls.name})</strong><br>`
        + lines.join("<br>")
        + (unmatched.length ? `<br><em>Not found in compendia (add manually): ${unmatched.join(", ")}</em>` : ""),
      rolls
    });
  }

  /** Rac/GM correction: unlock the Step 9 equipment grant. */
  async unlockStartingEquipment() {
    if (!game.user.isGM) { ui.notifications.warn("Only the Rac (GM) can unlock this."); return; }
    await this.update({ "system.creation.equipmentGranted": false });
    ui.notifications.info(`${this.name}: starting equipment grant unlocked.`);
  }

  /** The blessing table key (fortune/duty/courage) for this character. */
  get blessingTableKey() {
    const key = this.classItem?.system.key ?? this.system.class;
    return CLASS_BLESSING_TABLE[key] ?? null;
  }

  /**
   * Roll new Blessings on the class's table (Genesis p.60-61). Rolls d%
   * (0-99) for each Blessing the character is entitled to but doesn't yet
   * have, rerolling duplicates and any the character already holds, then
   * grants the matching Blessing items from the compendium.
   * @param {number} [count]  How many to roll; defaults to the outstanding
   *                          entitlement (entitled - held).
   */
  async rollBlessings(count = null) {
    if (this.type !== "character") return;
    const tableKey = this.blessingTableKey;
    if (!tableKey) { ui.notifications.warn("This character's class has no Blessing table."); return; }

    // Starting entitlement (p.60) is a FLAT 2 if Faith >= 5, else 0 - not
    // scaled by Faith. Additional Blessings come from level-up increments
    // (p.62), which pass an explicit count. If no count is given, use the
    // outstanding STARTING entitlement.
    const faithMax = this.system.faith?.max || 0;
    const startingEntitled = (faithMax >= 5) ? 2 : 0;
    const have = this.items.filter(i => i.type === "blessing");
    const haveNames = new Set(have.map(i => i.name.toLowerCase()));
    const outstanding = (count !== null) ? count : Math.max(0, startingEntitled - have.length);
    if (outstanding <= 0) {
      ui.notifications.info(`${this.name} is not currently entitled to more Blessings (starting entitlement is ${startingEntitled}).`);
      return;
    }

    const pack = game.packs.get("holy-lands-rpg.blessings");
    const packDocs = pack ? await pack.getDocuments() : [];
    const findBlessing = name => packDocs.find(d => d.name.toLowerCase() === name.toLowerCase());

    const rolledNames = new Set();
    const toCreate = [];
    const rolls = [];
    const lines = [];
    let guard = 0;
    while ((toCreate.length < outstanding) && (guard++ < 500)) {
      const r = new Roll("1d100");
      await r.evaluate();
      const d = r.total - 1; // 0-99
      const name = blessingFromRoll(tableKey, d);
      if (!name) continue;
      const lower = name.toLowerCase();
      if (haveNames.has(lower) || rolledNames.has(lower)) continue; // unique
      rolledNames.add(lower);
      const match = findBlessing(name);
      if (!match) { lines.push(`d%=${d}: ${name} (not in compendium)`); continue; }
      const data = match.toObject(); delete data._id;
      toCreate.push(data);
      rolls.push(r);
      lines.push(`d%=${d}: <strong>${name}</strong>`);
    }

    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
    // Mark that starting Blessings have been granted (switches the sheet
    // target from the flat-2 starting rule to the lifetime figure).
    if (!this.system.creation?.blessingsGranted) {
      await this.update({ "system.creation.blessingsGranted": true });
    }

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Blessings (${this.classItem?.system.blessingsType ?? tableKey})</strong><br>`
        + lines.join("<br>")
        + `<br><em>Gained ${toCreate.length} Blessing${toCreate.length === 1 ? "" : "s"} (now has ${have.length + toCreate.length}).</em>`,
      rolls
    });
  }

  /** Mark miracle selection complete. */
  async markMiraclesSelected() {
    await this.update({ "system.creation.miraclesSelected": true });
  }

  /**
   * The class's Talent/Craft skill list (Genesis Ch7) as an array of names,
   * or null if the class doesn't define one (Adventurer/Fighter are handled
   * differently). The trailing "*" marker some entries carry is stripped.
   */
  get talentCraftList() {
    const raw = this.classItem?.system.talentCraftList || "";
    if (!raw.trim()) return null;
    return raw.split("\n").map(x => x.trim().replace(/\*$/, "")).filter(Boolean);
  }

  /**
   * Grant chosen Talents (+2 PF) and Crafts (+1 PF) from the class list at
   * creation. Skills are matched against the Skills compendium so links come
   * across; unmatched names become plain skills. Locks when done.
   * @param {string[]} talentNames  Exactly 5 skill names for Talents.
   * @param {string[]} craftNames   Exactly 3 (different) names for Crafts.
   */
  async grantTalentsAndCrafts(talentNames, craftNames) {
    if (this.type !== "character") return;
    if (this.system.creation?.talentsCraftsChosen) {
      ui.notifications.warn("Talents and Crafts have already been chosen.");
      return;
    }

    const pack = game.packs.get("holy-lands-rpg.skills");
    const packDocs = pack ? await pack.getDocuments() : [];
    const findSkill = name => packDocs.find(d => d.name.toLowerCase() === name.toLowerCase());
    const existing = new Set(this.items.filter(i => i.type === "skill").map(i => i.name.toLowerCase()));

    const build = (name, section, pf) => {
      const match = findSkill(name);
      const data = match
        ? foundry.utils.mergeObject(match.toObject(), { system: { skillType: section, pf } })
        : { name, type: "skill", img: "icons/svg/book.svg",
            system: { skillType: section, pf, combatAbilities: /combat\s*abilit/i.test(name), isCombatSkill: /^cs\s/i.test(name) } };
      delete data._id;
      return data;
    };

    const toCreate = [];
    const skipped = [];
    for (const name of talentNames) {
      if (existing.has(name.toLowerCase())) { skipped.push(name); continue; }
      toCreate.push(build(name, "talent", 2));
    }
    for (const name of craftNames) {
      if (existing.has(name.toLowerCase())) { skipped.push(name); continue; }
      toCreate.push(build(name, "craft", 1));
    }

    if (toCreate.length) await this.createEmbeddedDocuments("Item", toCreate);
    await this.update({ "system.creation.talentsCraftsChosen": true });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Step 6: Talents &amp; Crafts (${this.classItem?.name})</strong><br>`
        + `Talents (+2): ${talentNames.join(", ")}<br>`
        + `Crafts (+1): ${craftNames.join(", ")}`
        + (skipped.length ? `<br><em>Already held (skipped): ${skipped.join(", ")}</em>` : "")
    });
  }

  /** Rac/GM correction: unlock the Talents & Crafts choice. */
  async unlockTalentsCrafts() {
    if (!game.user.isGM) { ui.notifications.warn("Only the Rac (GM) can unlock this."); return; }
    await this.update({ "system.creation.talentsCraftsChosen": false });
    ui.notifications.info(`${this.name}: Talents & Crafts choice unlocked.`);
  }

  /** Rac/GM correction: unlock the starting Life & Faith roll. */
  async unlockStartingRoll() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the Rac (GM) can unlock the starting Life & Faith roll.");
      return;
    }
    await this.update({ "system.creation.startingRolled": false });
    ui.notifications.info(`${this.name}: starting Life & Faith roll unlocked.`);
  }

  /** Rac/GM correction: unlock the creation Step 4 save choice. */
  async unlockCreationSaveBonus() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the Rac (GM) can unlock the creation Save Bonus.");
      return;
    }
    await this.update({ "system.creation.saveBonusChosen": false });
    ui.notifications.info(`${this.name}: creation Save Bonus choice unlocked.`);
  }

  /** Rac/GM correction: unlock the creation attribute roll. */
  async unlockCreationAttributes() {
    if (!game.user.isGM) {
      ui.notifications.warn("Only the Rac (GM) can unlock attribute generation.");
      return;
    }
    await this.update({ "system.creation.attributesRolled": false });
    ui.notifications.info(`${this.name}: attribute generation unlocked.`);
  }

  /**
   * Roll starting Life and Faith from the Class item (Genesis Ch7):
   * Life = STR + END + class die (GE); Faith = (class attributes) + die (GE).
   */
  async rollStartingLifeFaith() {
    const cls = this.classItem;
    if (!cls) {
      ui.notifications.warn("No Class item on this character.");
      return;
    }
    if (!this.system.creation?.attributesRolled) {
      ui.notifications.warn("Roll Attributes (Step 2) before rolling starting Life and Faith - the formulas use STR, END, and the class Faith attributes.");
      return;
    }
    if (this.system.creation?.startingRolled) {
      ui.notifications.warn("Starting Life and Faith have already been rolled for this character.");
      return;
    }
    const attrs = this.system.attributes;

    const lifeRoll = new Roll(this.constructor.graceFormula(cls.system.lifeCreationDie || "1d6"));
    await lifeRoll.evaluate();
    const lifeMax = (attrs.str?.value || 0) + (attrs.end?.value || 0) + lifeRoll.total;

    const faithAttrs = cls.system.faithCreationAttrs ?? [];
    const faithAttrTotal = faithAttrs.reduce((sum, key) => sum + (attrs[key]?.value || 0), 0);
    const faithRoll = new Roll(this.constructor.graceFormula(cls.system.faithCreationDie || "1d4"));
    await faithRoll.evaluate();
    const faithMax = faithAttrTotal + faithRoll.total;

    await this.update({
      "system.life.max": lifeMax, "system.life.value": lifeMax,
      "system.faith.max": faithMax, "system.faith.value": faithMax,
      "system.creation.startingRolled": true,
      "system.creation.lifeDieResult": lifeRoll.total,
      "system.creation.faithDieResult": faithRoll.total
    });

    const faithAttrText = faithAttrs.length
      ? faithAttrs.map(k => attrs[k]?.label ?? k).join(" + ") + " + "
      : "";
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} - Starting Life &amp; Faith (${cls.name})</strong><br>`
        + `Life: STR ${attrs.str.value} + END ${attrs.end.value} + ${lifeRoll.total} = <strong>${lifeMax}</strong><br>`
        + `Faith: ${faithAttrText}${faithRoll.total} = <strong>${faithMax}</strong>`,
      rolls: [lifeRoll, faithRoll]
    });
  }

  /**
   * Level up (Progressing a Character, p.62): +1 Level; roll the class
   * per-level Life and Faith dice (GE) and add each to BOTH max and current;
   * remind about the manual gains (+1 Attribute, +1 Save, Skills, Blessings).
   */
  async levelUp() {
    const cls = this.classItem;
    if (!cls) {
      ui.notifications.warn("No Class item on this character - drop one from the Character Classes compendium first.");
      return;
    }
    const newLevel = (this.system.level || 1) + 1;

    const lifeRoll = new Roll(this.constructor.graceFormula(cls.system.lifePerLevelDie || "1d4"));
    await lifeRoll.evaluate();
    const faithRoll = new Roll(this.constructor.graceFormula(cls.system.faithPerLevelDie || "1d4"));
    await faithRoll.evaluate();

    const oldFaithMax = this.system.faith.max || 0;
    const newFaithMax = oldFaithMax + faithRoll.total;
    await this.update({
      "system.level": newLevel,
      "system.life.max": (this.system.life.max || 0) + lifeRoll.total,
      "system.life.value": (this.system.life.value || 0) + lifeRoll.total,
      "system.faith.max": newFaithMax,
      "system.faith.value": (this.system.faith.value || 0) + faithRoll.total
    });

    // Blessings on level-up (p.62): two new Blessings for each increment of
    // five (5) max Faith crossed by this level's Faith gain.
    const incrementsCrossed = Math.floor(newFaithMax / 5) - Math.floor(oldFaithMax / 5);
    const newBlessings = Math.max(0, incrementsCrossed) * 2;
    const blessingNote = (newBlessings > 0)
      ? `Blessings: crossed a Faith increment of 5 - gain ${newBlessings} new Blessing${newBlessings === 1 ? "" : "s"} (use Roll Blessings).`
      : `Blessings: no new Blessings this level (none gained until max Faith next crosses a multiple of 5).`;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `<strong>${this.name} reaches Level ${newLevel}!</strong> (${cls.name})<br>`
        + `Life +${lifeRoll.total} (max and current), Faith +${faithRoll.total} (max and current).<br>`
        + `<em>Also gain: +1 to one Attribute and +1 to one Saving Throw (Rule of Halves applies); `
        + `new Talent at Levels 2-3 / new Craft at Levels 3-7 (start at +1 PF); `
        + `Saints and Clerics select new Miracles. `
        + `${blessingNote}</em>`,
      rolls: [lifeRoll, faithRoll]
    });
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
   * Roll a skill check (d20 + PF, higher is better).
   * @param {string} skillId  The embedded skill item's id.
   */
  async rollSkill(skillId, df = 10) {
    const skill = this.items.get(skillId);
    if (!skill || (skill.type !== "skill")) return;

    const pf = skill.system.pf || 0;
    const roll = new Roll("1d20 + @mod", { mod: pf });
    await roll.evaluate();

    const success = roll.total >= df;
    const crits = this.criticalRollsEnabled;
    const critSuccess = crits && roll.terms[0].results?.some(r => r.result === 20);
    const critFail = crits && roll.terms[0].results?.some(r => r.result === 1);

    let flavor = `${skill.name} (DF ${df})`;
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
    let { mode = "attack", multiplier = 1, modifier = 0, free = false, isCounter = false } = options;

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

    // Attacking with a weapon makes that Weapon Skill the active attack type
    // (so the sheet/tracker AtR follows what you're actually using). Free
    // counters don't change your chosen stance.
    if (!free && (this.system.activeWeaponSkill !== weaponSkill)) {
      await this.setActiveWeaponSkill(weaponSkill);
    }

    // Page 51 ("Using two or more Weapon Skills"): the first Weapon Skill a
    // character attacks with in a Round is their opener. Switching to a
    // DIFFERENT Weapon Skill later that Round must be rolled as a Special.
    // (The "all previous attacks succeeded" and realism conditions are left
    // to the Rac.) Free counters are exempt and don't set the opener.
    if (!free) {
      const opener = this.roundWeaponSkill;
      if (opener === null) {
        await this.setRoundWeaponSkill(weaponSkill);
      }
      else if ((opener !== weaponSkill) && (mode !== "special")) {
        mode = "special";
        multiplier = 1; // a Special is a single action, not a multiplied Critical
        ui.notifications.info(`${ws.label} follows a different Weapon Skill this Round - resolved as a Special (p.51).`);
      }
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
        await this.spendActionAtR(atrCost);
      }
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weaponName}${modeLabel} Attack: <strong>Natural 1 - Automatic Failure!</strong>${free ? "" : " Next defensive action is a Half Roll."}`,
        rolls: [roll]
      });
    }

    // No target: just show the attack roll.
    if (!targetActor) {
      await this.spendActionAtR(atrCost);
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        flavor: `${weaponName}${modeLabel} Attack: ${attackTotal}${bonusNote}${isNat20 ? " (Natural 20!)" : ""}`,
        rolls: [roll]
      });
    }

    // GATE A: the attack must exceed the defender's tDEF.
    const defenderTDEF = targetActor.system?.defense?.tDEF || 4;
    if (!isNat20 && (attackTotal <= defenderTDEF)) {
      await this.spendActionAtR(atrCost);
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
      attackTotal, isNat20, mode, multiplier, free, isCounter,
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
        await this.spendActionAtR(atrCost);
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
    const { attackTotal, isNat20: isNat20Attack, free, isCounter = false, atrCost, weaponSkill } = attackContext;

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
      await this.spendActionAtR(atrCost);
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `${defender.name} rolled a <strong>Natural 20 ${defenseType.capitalize()}!</strong> The attack is stopped and ${defender.name} gains a free counter-attack (no AtR).`,
        rolls: [defenseRoll]
      });
      // A counter does not spawn another counter (Combat Handbook: the
      // exchange resolves, then the Rac chooses who acts next).
      if (isCounter) return this.#handBackToRac(defender, this);
      return this._offerCounterAttack(defender, this, { free: true });
    }

    // Natural 1 Defense: automatic failure, 1.5x Damage.
    if (isNat1Defense) {
      await this.spendActionAtR(atrCost);
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
    await this.spendActionAtR(atrCost);

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
    // immediately if they have AtR remaining (Ch5, "Return Attack"). This is
    // OPTIONAL - the defender may decline. Crucially it does not loop: a
    // return/counter attack does not itself grant another return attack;
    // once it resolves, control passes back to the Rac to choose who acts
    // next (Combat Handbook, Section 5 & p.49).
    if (!free && !isCounter) return this._offerCounterAttack(defender, this, { free: false });
    if (isCounter) return this.#handBackToRac(defender, this);
  }

  /**
   * After a return/counter attack resolves, post a short note handing control
   * back to the Rac - the exchange is over and the Rac decides who goes next
   * (Holy Lands RPG has no fixed initiative loop).
   */
  async #handBackToRac(counterAttacker, originalAttacker) {
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: counterAttacker }),
      flavor: `<em>The exchange between ${counterAttacker.name} and ${originalAttacker.name} is resolved. The Rac decides who acts next.</em>`
    });
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
    if (!proceed) {
      // Declined - the return attack is optional; hand back to the Rac.
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: defender }),
        flavor: `<em>${defender.name} declines the ${kind}. The Rac decides who acts next.</em>`
      });
    }

    return defender.rollAttack(counterWeapon, attacker, { free, isCounter: true });
  }

  /** Resolve damage and apply armor degradation. */
  async _resolveDamage(weapon, defender, attackContext) {
    const { isNat20Attack = false, isNat1Defense = false, mode = "attack", multiplier = 1 } = {
      isNat20Attack: attackContext.isNat20,
      isNat1Defense: attackContext.isNat1Defense ?? false,
      mode: attackContext.mode,
      multiplier: attackContext.multiplier
    };
    const damageFormula = this.weaponDamageFormula(weapon);
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
    let damageFormula = this.weaponDamageFormula(weapon);
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
