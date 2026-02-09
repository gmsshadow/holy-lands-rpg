export class HolyLandsItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["holy-lands-rpg", "sheet", "item"],
      width: 520,
      height: 480,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/holy-lands-rpg/templates/item";
    return `${path}/item-${this.item.type}-sheet.hbs`;
  }

  /** @override */
  async getData() {
    const context = super.getData();
    const itemData = this.item.toObject(false);

    context.rollData = {};
    let actor = this.object?.parent ?? null;
    if (actor) {
      context.rollData = actor.getRollData();
    }

    context.system = itemData.system;
    context.flags = itemData.flags;

    // Add type-specific data
    if (itemData.type === 'weapon') {
      context.weaponSkills = {
        lightArms: "Light Arms",
        heavyArms: "Heavy Arms",
        missile: "Missile",
        thrown: "Thrown"
      };
    }

    if (itemData.type === 'armor') {
      context.armorPlacements = {
        head: "Head",
        chest: "Chest",
        arms: "Arms",
        legs: "Legs",
        feet: "Feet",
        back: "Back"
      };
    }

    if (itemData.type === 'skill') {
      context.skillTypes = {
        gift: "Gift",
        talent: "Talent",
        craft: "Craft"
      };
    }

    return context;
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    if (!this.isEditable) return;

    // Roll handlers
    html.find('.rollable').click(this._onRoll.bind(this));
  }

  /**
   * Handle clickable rolls
   */
  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.roll) {
      let label = dataset.label ? `Rolling ${dataset.label}` : '';
      let roll = new Roll(dataset.roll, this.item.getRollData());
      roll.toMessage({
        speaker: ChatMessage.getSpeaker({ actor: this.actor }),
        flavor: label,
        rollMode: game.settings.get('core', 'rollMode'),
      });
      return roll;
    }
  }
}
