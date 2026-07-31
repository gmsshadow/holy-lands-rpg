/**
 * Holy Lands RPG System for Foundry VTT (v13/v14)
 * Based on the Holy Lands RPG Trinity Book 1: Genesis
 */

import { HolyLandsActor } from "./documents/actor.mjs";
import { HolyLandsItem } from "./documents/item.mjs";
import { HolyLandsCombat } from "./documents/combat.mjs";
import { HolyLandsActorSheet } from "./sheets/actor-sheet.mjs";
import { HolyLandsItemSheet } from "./sheets/item-sheet.mjs";
import { CharacterData } from "./data/actor-character.mjs";
import { NpcData } from "./data/actor-npc.mjs";
import {
  WeaponData, ArmorData, EquipmentData, MiracleData, BlessingData, SkillData
} from "./data/items.mjs";

const { Actors, Items } = foundry.documents.collections;

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once("init", function() {
  console.log("Holy Lands RPG | Initializing Holy Lands RPG System");

  // Define custom Document classes
  CONFIG.Actor.documentClass = HolyLandsActor;
  CONFIG.Item.documentClass = HolyLandsItem;
  CONFIG.Combat.documentClass = HolyLandsCombat;

  // Register system data models (replaces template.json)
  CONFIG.Actor.dataModels = {
    character: CharacterData,
    npc: NpcData
  };
  CONFIG.Item.dataModels = {
    weapon: WeaponData,
    armor: ArmorData,
    equipment: EquipmentData,
    miracle: MiracleData,
    blessing: BlessingData,
    skill: SkillData
  };

  // Configure Combat settings
  CONFIG.Combat.initiative = {
    formula: "1d20 + @combat.advantageBonus",
    decimals: 0
  };

  // Register sheet application classes (ApplicationV2)
  Actors.unregisterSheet("core", foundry.appv1.sheets.ActorSheet);
  Actors.registerSheet("holy-lands-rpg", HolyLandsActorSheet, {
    types: ["character", "npc"],
    makeDefault: true,
    label: "Holy Lands Actor Sheet"
  });

  Items.unregisterSheet("core", foundry.appv1.sheets.ItemSheet);
  Items.registerSheet("holy-lands-rpg", HolyLandsItemSheet, {
    makeDefault: true,
    label: "Holy Lands Item Sheet"
  });

  // Register system settings
  registerSystemSettings();

  // Register Handlebars helpers
  registerHandlebarsHelpers();
});

/* -------------------------------------------- */
/*  System Settings                             */
/* -------------------------------------------- */

function registerSystemSettings() {
  game.settings.register("holy-lands-rpg", "graceEffect", {
    name: "Use Grace Effect",
    hint: "Reroll natural 1s on attribute generation (recommended for player characters)",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register("holy-lands-rpg", "criticalRolls", {
    name: "Use Critical Rolls",
    hint: "Natural 20s and 1s have special effects",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });
}

/* -------------------------------------------- */
/*  Handlebars Helpers                          */
/* -------------------------------------------- */

function registerHandlebarsHelpers() {
  Handlebars.registerHelper("times", function(n, block) {
    let accum = "";
    for (let i = 0; i < n; ++i) accum += block.fn(i);
    return accum;
  });

  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => a > b);
  Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
  Handlebars.registerHelper("subtract", (a, b) => Number(a) - Number(b));
}

/* -------------------------------------------- */
/*  Combat Hooks                                */
/* -------------------------------------------- */

Hooks.on("combatStart", async (combat, updateData) => {
  console.log("Holy Lands RPG | Combat started");
  // Reset all AtR and round-scoped combat flags at combat start
  for (const combatant of combat.combatants) {
    if (combatant.actor?.resetAtRPersisted) await combatant.actor.resetAtRPersisted();
    if (combatant.actor?.clearRoundCombatFlags) await combatant.actor.clearRoundCombatFlags();
  }
});

Hooks.on("combatRound", async (combat, updateData, updateOptions) => {
  console.log("Holy Lands RPG | New combat round");
  // Reset all AtR and round-scoped combat flags at the start of each round
  for (const combatant of combat.combatants) {
    if (combatant.actor?.resetAtRPersisted) await combatant.actor.resetAtRPersisted();
    if (combatant.actor?.clearRoundCombatFlags) await combatant.actor.clearRoundCombatFlags();
  }
});

/* -------------------------------------------- */
/*  Chat Message Handlers                       */
/* -------------------------------------------- */

Hooks.on("renderChatMessageHTML", (message, html, context) => {
  // Add roll type classes (html is an HTMLElement in v13+)
  if (!message.isRoll) return;
  if (!game.settings.get("holy-lands-rpg", "criticalRolls")) return;
  const roll = message.rolls[0];
  const term = roll?.terms?.[0];
  if (term?.faces !== 20) return;

  const totalEl = html.querySelector(".dice-total");
  if (!totalEl) return;

  if (term.results?.some(r => r.result === 20)) totalEl.classList.add("critical-success");
  else if (term.results?.some(r => r.result === 1)) totalEl.classList.add("critical-failure");
});

/* -------------------------------------------- */
/*  Dice Rolling Utilities                      */
/* -------------------------------------------- */

export class HolyLandsDice {
  /**
   * Roll attributes with the Grace Effect option.
   * The Grace Effect rerolls only the individual dice that show a Natural 1,
   * repeatedly, until each is above one (Genesis Ch6, Step 2) - implemented
   * with the recursive reroll modifier (e.g. 3d4 becomes 3d4rr1) so each die
   * rerolls independently and the chat card shows the discarded rolls.
   */
  static async rollAttribute(formula, graceEffect = true) {
    let rollFormula = formula;
    if (graceEffect && game.settings.get("holy-lands-rpg", "graceEffect")) {
      rollFormula = formula.replace(/(\d*)d(\d+)/gi, "$&rr1");
    }
    const roll = new Roll(rollFormula);
    await roll.evaluate();
    return roll;
  }

  /**
   * Roll a d20 skill/ability check
   */
  static async rollCheck(actor, type, name, bonus = 0) {
    const roll = new Roll("1d20 + @bonus", { bonus });
    await roll.evaluate();

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${name} Check`,
      rolls: [roll]
    });
  }

  /**
   * Roll a saving throw
   */
  static async rollSave(actor, saveName, df) {
    const saveBonus = actor.system.saves[saveName]?.value || 0;
    const roll = new Roll("1d20 + @bonus", { bonus: saveBonus });
    await roll.evaluate();

    const success = roll.total >= df;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${saveName} Save (DF ${df}) - ${success ? "Success!" : "Failed"}`,
      rolls: [roll]
    });
  }

  /**
   * Roll an attribute check (d12, low roll wins)
   */
  static async rollAttributeCheck(actor, attrName, attrValue) {
    const roll = new Roll("1d12");
    await roll.evaluate();

    const success = roll.total <= attrValue;
    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${attrName} Check (${attrValue}) - ${success ? "Success!" : "Failed"}`,
      rolls: [roll]
    });
  }
}

// Make globally available
window.HolyLandsDice = HolyLandsDice;
