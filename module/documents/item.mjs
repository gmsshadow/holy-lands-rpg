/**
 * Extend the base Item document for Holy Lands RPG
 */
export class HolyLandsItem extends Item {

  /** @override */
  prepareData() {
    super.prepareData();
  }

  /** @override */
  prepareBaseData() {
    // Data preparation specific to item types
  }

  /** @override */
  prepareDerivedData() {
    const itemData = this;
    const systemData = itemData.system;
    const flags = itemData.flags.holyLandsRpg || {};

    // Make modifications to data here
  }

  /**
   * Handle clickable rolls
   */
  async roll() {
    const item = this;

    // Basic template for the roll
    const speaker = ChatMessage.getSpeaker({ actor: this.actor });
    const rollMode = game.settings.get('core', 'rollMode');
    const label = `[${item.type}] ${item.name}`;

    // If there's no roll data, send a basic message
    if (!this.system.formula) {
      ChatMessage.create({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label,
        content: item.system.description ?? ''
      });
    }
    // Otherwise, create a roll with the item's formula
    else {
      const rollData = this.getRollData();
      const roll = new Roll(item.system.formula, rollData);
      await roll.evaluate();
      
      roll.toMessage({
        speaker: speaker,
        rollMode: rollMode,
        flavor: label
      });

      return roll;
    }
  }

  /**
   * Prepare roll data for items
   */
  getRollData() {
    if (!this.actor) return null;
    const rollData = this.actor.getRollData();
    return rollData;
  }

  /**
   * Cast a miracle
   */
  async castMiracle() {
    if (this.type !== 'miracle') return;

    const actor = this.actor;
    if (!actor) {
      ui.notifications.warn("This miracle is not owned by an actor.");
      return;
    }

    const faithCost = this.system.faithCost || 0;
    const currentFaith = actor.system.faith.value;

    // Check if enough faith
    if (currentFaith < faithCost) {
      ui.notifications.warn("Not enough Faith to cast this miracle!");
      return;
    }

    // Deduct faith
    await actor.update({
      "system.faith.value": currentFaith - faithCost
    });

    // Create chat message
    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Miracle: ${this.name}`,
      content: `
        <div class="holy-lands-miracle">
          <h3>${this.name}</h3>
          <p><strong>Faith Cost:</strong> ${faithCost}</p>
          <p><strong>Range:</strong> ${this.system.range || 'Touch'}</p>
          <p><strong>Duration:</strong> ${this.system.duration || 'Instantaneous'}</p>
          <hr>
          <p>${this.system.description}</p>
        </div>
      `
    };

    return ChatMessage.create(chatData);
  }

  /**
   * Use a blessing
   */
  async useBlessing() {
    if (this.type !== 'blessing') return;

    const actor = this.actor;
    if (!actor) {
      ui.notifications.warn("This blessing is not owned by an actor.");
      return;
    }

    // Blessings don't cost faith, but may have other requirements
    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Blessing: ${this.name}`,
      content: `
        <div class="holy-lands-blessing">
          <h3>${this.name}</h3>
          <p><strong>Duration:</strong> ${this.system.duration || 'Varies'}</p>
          <hr>
          <p>${this.system.description}</p>
        </div>
      `
    };

    return ChatMessage.create(chatData);
  }
}
