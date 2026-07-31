const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditorImpl = foundry.applications.ux.TextEditor.implementation;

/**
 * ApplicationV2 item sheet for Holy Lands RPG.
 * A single class serves all item types; the rendered template is chosen
 * per-item-type in _configureRenderParts.
 */
export class HolyLandsItemSheet extends HandlebarsApplicationMixin(ItemSheetV2) {

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ["holy-lands-rpg", "sheet", "item"],
    position: { width: 520, height: 480 },
    form: { submitOnChange: true },
    window: { resizable: true },
    actions: {
      editImage: HolyLandsItemSheet.#onEditImage,
      roll: HolyLandsItemSheet.#onRoll
    }
  };

  /** @override */
  static PARTS = {
    // Template is replaced per-item-type in _configureRenderParts
    body: {
      template: "systems/holy-lands-rpg/templates/item/item-equipment-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  /** Active tab state (used by the weapon sheet). */
  tabGroups = { primary: "description" };

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    parts.body.template = `systems/holy-lands-rpg/templates/item/item-${this.item.type}-sheet.hbs`;
    return parts;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const item = this.item;

    context.item = item;
    context.system = item.system;
    context.flags = item.flags;
    context.editable = this.isEditable;
    context.owner = item.isOwner;
    context.rollData = item.actor?.getRollData() ?? {};

    // Enriched description for the prose-mirror editor
    context.enrichedDescription = await TextEditorImpl.enrichHTML(item.system.description ?? "", {
      relativeTo: item,
      rollData: context.rollData,
      secrets: item.isOwner
    });

    // Tab state for the weapon sheet
    const active = this.tabGroups.primary;
    context.tabs = {
      description: { id: "description", group: "primary", cssClass: (active === "description") ? "active" : "" },
      details: { id: "details", group: "primary", cssClass: (active === "details") ? "active" : "" }
    };

    // Type-specific selection choices
    if (item.type === "weapon") {
      context.weaponSkills = {
        handToHand: "Hand To Hand",
        lightArms: "Light Arms",
        heavyArms: "Heavy Arms",
        pairedWeapons: "Paired Weapons",
        missile: "Missile",
        thrown: "Thrown",
        kickAttack: "Kick Attack"
      };
    }
    if (item.type === "armor") {
      context.armorPlacements = {
        head: "Head",
        chest: "Chest",
        arms: "Arms",
        legs: "Legs",
        feet: "Feet",
        back: "Back"
      };
    }
    if (item.type === "skill") {
      context.skillTypes = {
        gift: "Gift",
        talent: "Talent",
        craft: "Craft"
      };
    }
    if (item.type === "class") {
      context.classKeys = {
        adventurer: "Adventurer", bard: "Bard", cleric: "Cleric",
        devilHunter: "Devil Hunter", fighter: "Fighter", jester: "Jester",
        knight: "Knight", saint: "Saint", saisier: "Saisier",
        scout: "Scout", spy: "Spy", voyager: "Voyager", warrior: "Warrior"
      };
      context.staturesCsv = (item.system.statures ?? []).join(",");
      context.faithAttrsCsv = (item.system.faithCreationAttrs ?? []).join(",");
      context.attributeKeys = {
        int: "Intellect", wis: "Wisdom", pat: "Patience", will: "Will",
        mem: "Memory", str: "Strength", agi: "Agility", spd: "Speed",
        end: "Endurance", bty: "Beauty", cha: "Charisma", vir: "Virtue"
      };
    }

    return context;
  }

  /** @override Convert comma-separated array inputs before submission. */
  _processFormData(event, form, formData) {
    const data = super._processFormData(event, form, formData);
    for (const path of ["system.statures", "system.faithCreationAttrs"]) {
      const value = foundry.utils.getProperty(data, path);
      if (typeof value === "string") {
        foundry.utils.setProperty(data, path,
          value.split(",").map(x => x.trim()).filter(x => x.length));
      }
    }
    return data;
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  static async #onEditImage(event, target) {
    const attr = target.dataset.edit || "img";
    const current = foundry.utils.getProperty(this.document, attr);
    const fp = new foundry.applications.apps.FilePicker.implementation({
      type: "image",
      current,
      callback: path => this.document.update({ [attr]: path })
    });
    return fp.browse();
  }

  static #onRoll(event, target) {
    const dataset = target.dataset;
    if (!dataset.roll) return;

    const label = dataset.label ? `Rolling ${dataset.label}` : "";
    const roll = new Roll(dataset.roll, this.item.getRollData());
    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this.item.actor }),
      flavor: label,
      rollMode: game.settings.get("core", "rollMode")
    });
  }
}
