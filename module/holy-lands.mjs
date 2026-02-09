/**
 * Holy Lands RPG System for Foundry VTT
 * Based on the Holy Lands RPG Trinity Book 1: Genesis
 */

import { HolyLandsActor } from "./documents/actor.mjs";
import { HolyLandsItem } from "./documents/item.mjs";
import { HolyLandsActorSheet } from "./sheets/actor-sheet.mjs";
import { HolyLandsItemSheet } from "./sheets/item-sheet.mjs";

/* -------------------------------------------- */
/*  Init Hook                                   */
/* -------------------------------------------- */

Hooks.once('init', async function() {
  console.log('Holy Lands RPG | Initializing Holy Lands RPG System');

  // Define custom Document classes
  CONFIG.Actor.documentClass = HolyLandsActor;
  CONFIG.Item.documentClass = HolyLandsItem;

  // Register sheet application classes
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("holy-lands-rpg", HolyLandsActorSheet, { 
    types: ["character", "npc"],
    makeDefault: true 
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("holy-lands-rpg", HolyLandsItemSheet, { 
    makeDefault: true 
  });

  // Register system settings
  registerSystemSettings();

  // Preload Handlebars templates
  return preloadHandlebarsTemplates();
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

Hooks.once('ready', async function() {
  // Define Handlebars helpers
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for(let i = 0; i < n; ++i)
      accum += block.fn(i);
    return accum;
  });

  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
  });

  Handlebars.registerHelper('add', function(a, b) {
    return Number(a) + Number(b);
  });

  Handlebars.registerHelper('subtract', function(a, b) {
    return Number(a) - Number(b);
  });
});

/* -------------------------------------------- */
/*  Preload Templates                           */
/* -------------------------------------------- */

async function preloadHandlebarsTemplates() {
  return loadTemplates([
    // Actor partials
    "systems/holy-lands-rpg/templates/actor/parts/actor-attributes.hbs",
    "systems/holy-lands-rpg/templates/actor/parts/actor-abilities.hbs",
    "systems/holy-lands-rpg/templates/actor/parts/actor-skills.hbs",
    "systems/holy-lands-rpg/templates/actor/parts/actor-combat.hbs",
    "systems/holy-lands-rpg/templates/actor/parts/actor-equipment.hbs",
    "systems/holy-lands-rpg/templates/actor/parts/actor-miracles.hbs"
  ]);
}

/* -------------------------------------------- */
/*  Chat Message Handlers                       */
/* -------------------------------------------- */

Hooks.on("renderChatMessage", (message, html, data) => {
  // Add roll type classes
  if (message.isRoll) {
    const roll = message.rolls[0];
    if (roll) {
      const total = roll.total;
      const terms = roll.terms[0];
      
      if (terms?.faces === 20) {
        if (terms.results?.some(r => r.result === 20)) {
          html.find('.dice-total').addClass('critical-success');
        } else if (terms.results?.some(r => r.result === 1)) {
          html.find('.dice-total').addClass('critical-failure');
        }
      }
    }
  }
});

/* -------------------------------------------- */
/*  Dice Rolling Utilities                      */
/* -------------------------------------------- */

export class HolyLandsDice {
  /**
   * Roll attributes with Grace Effect option
   */
  static async rollAttribute(formula, graceEffect = true) {
    let roll = new Roll(formula);
    await roll.evaluate();
    
    // Apply Grace Effect - reroll natural 1s
    if (graceEffect && game.settings.get("holy-lands-rpg", "graceEffect")) {
      let rerolled = false;
      let newFormula = formula;
      
      // Check for any 1s in the roll
      for (let term of roll.terms) {
        if (term.results) {
          const hasOne = term.results.some(r => r.result === 1);
          if (hasOne) {
            rerolled = true;
            // Keep rerolling until no 1s
            while (term.results.some(r => r.result === 1)) {
              roll = new Roll(formula);
              await roll.evaluate();
              term = roll.terms[0];
            }
          }
        }
      }
    }
    
    return roll;
  }

  /**
   * Roll a d20 skill/ability check
   */
  static async rollCheck(actor, type, name, bonus = 0) {
    const roll = new Roll("1d20 + @bonus", { bonus });
    await roll.evaluate();

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `${name} Check`,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll a saving throw
   */
  static async rollSave(actor, saveName, df) {
    const saveBonus = actor.system.saves[saveName] || 0;
    const roll = new Roll("1d20 + @bonus", { bonus: saveBonus });
    await roll.evaluate();

    const success = roll.total >= df;
    const flavor = `${saveName} Save (DF ${df}) - ${success ? "Success!" : "Failed"}`;

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Roll an attribute check (d12, low roll wins)
   */
  static async rollAttributeCheck(actor, attrName, attrValue) {
    const roll = new Roll("1d12");
    await roll.evaluate();

    const success = roll.total <= attrValue;
    const flavor = `${attrName} Check (${attrValue}) - ${success ? "Success!" : "Failed"}`;

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor,
      type: CONST.CHAT_MESSAGE_TYPES.ROLL,
      rolls: [roll]
    };

    return ChatMessage.create(chatData);
  }
}

// Make globally available
window.HolyLandsDice = HolyLandsDice;
