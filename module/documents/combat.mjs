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
    
    return super.nextRound();
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
