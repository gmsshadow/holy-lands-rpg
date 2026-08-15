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

    // Initialize armor current values if not set
    if (this.type === 'armor') {
      if (systemData.currentADEF === undefined && systemData.aDEF !== undefined) {
        systemData.currentADEF = systemData.aDEF;
      }
      if (systemData.currentPEN === undefined && systemData.PEN !== undefined) {
        systemData.currentPEN = systemData.PEN;
      }
    }
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
  /**
   * Use a consumable (Book of Life, Ch13 healing drafts & holy oils). Applies:
   *  - the heal formula (via applyDamage, negative = healing);
   *  - coma relief (+Nd Life and clears the coma) and Terminal removal;
   *  - setting Broken injuries;
   * then posts the effect and any toxicity/overuse note, and decrements the
   * quantity. The toxicity layer is surfaced as a warning (the Rac applies the
   * toxin if the overuse window is exceeded) rather than auto-tracked.
   */
  async useConsumable() {
    if (this.type !== "consumable") return;
    const actor = this.actor;
    if (!actor) { ui.notifications.warn("This consumable is not owned by an actor."); return; }

    const sys = this.system;
    const lines = [];

    // Terminal removal FIRST - applyDamage (healing) is blocked while Terminal,
    // and Hospice Oil both removes Terminal and restores Life, so order matters.
    if (sys.removesTerminal && actor.hasCondition?.("terminal")) {
      await actor.clearCondition("terminal");
      lines.push("removes the Terminal effect");
    }

    // Coma relief (Hospice Oil): clear coma, restore a little Life.
    if (sys.relievesComa && actor.hasCondition?.("coma")) {
      let restored = 0;
      if (sys.comaReliefFormula) {
        const r = new Roll(sys.comaReliefFormula); await r.evaluate();
        restored = r.total;
      }
      await actor.clearCondition("coma");
      if (restored > 0) await actor.applyDamage(-restored, { source: this.name, silent: true });
      lines.push(`relieves the coma (+${restored} Life)`);
    }

    // Set a Broken injury (stops it turning Terminal).
    if (sys.setsBroken && actor.hasCondition?.("broken") && !actor.conditions.broken?.isSet) {
      await actor.setBrokenInjury();
      lines.push("sets the Broken injury");
    }

    // General healing (drafts, Oil of Life, etc.).
    if (sys.healFormula) {
      const r = new Roll(sys.healFormula); await r.evaluate();
      await actor.applyDamage(-r.total, { source: this.name, silent: true });
      lines.push(`heals ${r.total} Life`);
    }

    if (!lines.length) lines.push("no effect in the current state");

    // Toxicity / overuse note (Rac-adjudicated).
    let toxNote = "";
    if (sys.toxinClass > 0) {
      toxNote = `<br><em>Toxicity: acts as a Class ${sys.toxinClass} toxin if taken more than ${sys.overuseWindow || "the safe rate"}.</em>`;
    }
    const extra = sys.effectNote ? `<br>${sys.effectNote}` : "";

    // Decrement quantity.
    const qty = Math.max(0, (sys.quantity || 1) - 1);
    await this.update({ "system.quantity": qty });

    return ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `<strong>${actor.name} uses ${this.name}</strong> - ${lines.join("; ")}.${extra}${toxNote}<br><span class="hint">${qty} remaining.</span>`
    });
  }

  async castMiracle() {
    if (this.type !== 'miracle') return;

    const actor = this.actor;
    if (!actor) {
      ui.notifications.warn("This miracle is not owned by an actor.");
      return;
    }

    const baseCost = this.system.faithCost || 0;
    const surcharge = actor.sinFaithSurcharge || 0; // Doubt: +3 to all Faith costs
    const faithCost = baseCost + surcharge;
    const currentFaith = actor.system.faith.value;

    // Check if enough faith
    if (currentFaith < faithCost) {
      ui.notifications.warn(`Not enough Faith to cast this miracle!${surcharge ? ` (Doubt adds +${surcharge})` : ""}`);
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
      `,
      flags: { "holy-lands-rpg": { expAward: {
        actorId: actor.id, tokenUuid: actor.token?.uuid ?? null,
        category: "miracle", df: null, suggested: actor.constructor.EXP_AWARDS.miracle[7]
      } } }
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

    // Blessings cost Faith to perform (default 5 - Genesis Ch11, "Blessings")
    const baseCost = this.system.faithCost ?? 5;
    const surcharge = actor.sinFaithSurcharge || 0; // Doubt: +3 to all Faith costs
    const blessingCost = baseCost + surcharge;
    const currentFaith = actor.system.faith.value;
    if (currentFaith < blessingCost) {
      ui.notifications.warn(`Not enough Faith to perform this Blessing (costs ${blessingCost} Faith${surcharge ? `, incl. +${surcharge} Doubt` : ""})!`);
      return;
    }
    await actor.update({ "system.faith.value": currentFaith - blessingCost });

    const chatData = {
      speaker: ChatMessage.getSpeaker({ actor }),
      flavor: `Blessing: ${this.name}`,
      content: `
        <div class="holy-lands-blessing">
          <h3>${this.name}</h3>
          <p><strong>Faith Cost:</strong> ${blessingCost}</p>
          <p><strong>Duration:</strong> ${this.system.duration || 'Varies'}</p>
          <hr>
          <p>${this.system.description}</p>
        </div>
      `,
      flags: { "holy-lands-rpg": { expAward: {
        actorId: actor.id, tokenUuid: actor.token?.uuid ?? null,
        category: "miracle", df: null, suggested: actor.constructor.EXP_AWARDS.miracle[7]
      } } }
    };

    return ChatMessage.create(chatData);
  }
}
