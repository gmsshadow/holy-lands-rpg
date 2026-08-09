/**
 * Extend the base Combat document for Holy Lands RPG
 */
export class HolyLandsCombat extends Combat {

  /** @override */
  async rollInitiative(ids, {formula=null, updateTurn=true, messageOptions={}}={}) {
    // Get combatants to roll for
    ids = typeof ids === "string" ? [ids] : ids;
    const combatants = ids.map(id => this.combatants.get(id));

    // Roll Advantage for each combatant
    const updates = [];
    const messages = [];

    for (let combatant of combatants) {
      if (!combatant?.actor) continue;

      // Get advantage bonus from actor
      const advantageBonus = combatant.actor.system.combat?.advantageBonus || 0;
      
      // Roll 1d20 + Advantage Bonus
      const roll = new Roll("1d20 + @bonus", { bonus: advantageBonus });
      await roll.evaluate();

      updates.push({
        _id: combatant.id,
        initiative: roll.total
      });

      // Natural 20 / Natural 1 Advantage effects (Genesis Ch5, "Advantage")
      let natNote = "";
      let natRoll = null;
      for (const term of roll.terms) {
        if (term.results?.length) { natRoll = term.results[0].result; break; }
      }
      if (natRoll === 20) {
        await combatant.actor.setCombatFlag?.("advNat20", true);
        natNote = " <strong>Natural 20!</strong> +3 to Attack, Critical, and Special until end of Round or they take Damage.";
      }
      else if (natRoll === 1) {
        await combatant.actor.setCombatFlag?.("advNat1", true);
        natNote = " <strong>Natural 1!</strong> -3 to all defensive actions until end of Round or they land a hit.";
      }

      // Create chat message for the roll
      const flavor = `<strong>${combatant.name}</strong> rolls Advantage!${natNote}`;
      const messageData = foundry.utils.mergeObject(
        {
          speaker: ChatMessage.getSpeaker({
            actor: combatant.actor,
            token: combatant.token,
            alias: combatant.name
          }),
          flavor,
          rolls: [roll]
        },
        messageOptions
      );
      messages.push(messageData);
    }

    // Update all combatant initiatives
    if (updates.length) {
      await this.updateEmbeddedDocuments("Combatant", updates);
    }

    // Create all chat messages
    for (let messageData of messages) {
      await ChatMessage.create(messageData);
    }

    // Optionally update the turn order
    if (updateTurn && combatants.length) {
      await this.update({turn: 0});
    }

    return this;
  }

  /** @override */
  async resetAll() {
    // Reset all combatant initiatives, AtR, and round-scoped combat flags
    for (const c of this.combatants) {
      if (c.actor?.resetAtRPersisted) await c.actor.resetAtRPersisted();
      if (c.actor?.clearRoundCombatFlags) await c.actor.clearRoundCombatFlags();
    }
    const updates = this.combatants.map(c => ({ _id: c.id, initiative: null }));
    await this.updateEmbeddedDocuments("Combatant", updates);
    return this;
  }

  /** @override */
  async nextRound() {
    // At the start of each new round, reset AtR and round-scoped combat flags
    for (const combatant of this.combatants) {
      if (combatant.actor?.resetAtRPersisted) await combatant.actor.resetAtRPersisted();
      if (combatant.actor?.clearRoundCombatFlags) await combatant.actor.clearRoundCombatFlags();
    }

    const result = await super.nextRound();

    // After the Round number advances, expire any conditions whose duration
    // has elapsed (Stunned/Dazed). Day-scale ones (Unconscious/Broken/
    // Terminal) persist until cleared by the Rac / recovery.
    for (const combatant of this.combatants) {
      if (combatant.actor?.tickConditions) await combatant.actor.tickConditions();
    }

    return result;
  }

  /**
   * Holy Lands RPG does not use fixed D&D-style initiative order (Combat
   * Handbook, Section 5). The highest Advantage roll acts first, but after
   * that the Rac decides who goes next - and it may be the same combatant
   * again. So instead of auto-advancing through the sorted list, we prompt
   * the GM to choose the next actor. Non-GM clients fall back to the default
   * behaviour (they can't drive turn order anyway).
   * @override
   */
  async nextTurn() {
    if (!game.user.isGM) return super.nextTurn();

    // If every combatant is out of AtR, advance to the next Round instead.
    const anyAtR = this.combatants.some(c => {
      if (!c.actor?.system?.weaponSkills) return true; // no WS data -> don't block
      return (c.actor.activeAtR?.current ?? 0) > 0;
    });
    if (!anyAtR) {
      ui.notifications.info("All combatants are out of AtR - advancing to the next Round.");
      return this.nextRound();
    }

    const chosen = await this.#promptNextCombatant();
    if (chosen === null) return; // cancelled - stay on current turn

    const turnIndex = this.turns.findIndex(t => t.id === chosen);
    if (turnIndex >= 0) return this.update({ turn: turnIndex });
    return super.nextTurn();
  }

  /**
   * Ask the Rac which combatant acts next. Lists all combatants with their
   * Advantage roll and remaining AtR; the current actor is selectable again
   * (the Rac may let someone keep acting). Returns the chosen combatant id,
   * or null if cancelled.
   */
  async #promptNextCombatant() {
    const options = this.turns.map(c => {
      const active = c.actor?.system?.weaponSkills ? c.actor.activeAtR : null;
      const adv = Number.isNumeric(c.initiative) ? c.initiative : "-";
      const atrLabel = active ? ` - ${active.label} AtR ${active.current}/${active.max}` : "";
      const current = (c.id === this.combatant?.id) ? " (current)" : "";
      const spent = (active && active.current === 0) ? " [no AtR]" : "";
      return `<option value="${c.id}">${foundry.utils.escapeHTML(c.name)} (ADV ${adv}${atrLabel})${current}${spent}</option>`;
    }).join("");

    const DialogV2 = foundry.applications.api.DialogV2;
    const chosen = await DialogV2.wait({
      window: { title: "Who acts next?" },
      content: `<p>Advantage decided the first actor. Choose who goes next - this may be the same combatant again (Combat Handbook, Section 5).</p>
        <div class="form-group"><label>Next to act:</label><select name="next" autofocus>${options}</select></div>`,
      buttons: [
        { action: "pick", label: "Act", default: true, callback: (event, button) => button.form.elements.next.value },
        { action: "endRound", label: "End Round", callback: () => "__END__" },
        { action: "cancel", label: "Cancel" }
      ],
      rejectClose: false
    });
    if (!chosen || chosen === "cancel") return null;
    if (chosen === "__END__") { await this.nextRound(); return null; }
    return chosen;
  }

  /** @override */
  _sortCombatants(a, b) {
    // Sort by initiative (Advantage roll), highest first
    const ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    const ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;
    
    if (ia !== ib) return ib - ia; // Higher advantage goes first
    
    // Tie-breaker: use Agility attribute
    const agiA = a.actor?.system?.attributes?.agi?.value || 0;
    const agiB = b.actor?.system?.attributes?.agi?.value || 0;
    
    if (agiA !== agiB) return agiB - agiA;
    
    // Final tie-breaker: token ID
    return a.id.localeCompare(b.id);
  }
}
