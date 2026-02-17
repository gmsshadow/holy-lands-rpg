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

      // Create chat message for the roll
      const flavor = `<strong>${combatant.name}</strong> rolls Advantage!`;
      const messageData = foundry.utils.mergeObject(
        {
          speaker: ChatMessage.getSpeaker({
            actor: combatant.actor,
            token: combatant.token,
            alias: combatant.name
          }),
          flavor,
          type: CONST.CHAT_MESSAGE_TYPES.ROLL,
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
    // Reset all combatant initiatives and reset AtR
    const updates = this.combatants.map(c => {
      // Reset AtR for actor if they have the method
      if (c.actor && typeof c.actor._resetAtR === 'function') {
        c.actor._resetAtR(c.actor.system);
      }
      
      return {
        _id: c.id,
        initiative: null
      };
    });
    
    await this.updateEmbeddedDocuments("Combatant", updates);
    return this;
  }

  /** @override */
  async nextRound() {
    // At the start of each new round, reset everyone's AtR
    for (let combatant of this.combatants) {
      if (combatant.actor && typeof combatant.actor._resetAtR === 'function') {
        await combatant.actor._resetAtR(combatant.actor.system);
        await combatant.actor.update({ 'system.weaponSkills': combatant.actor.system.weaponSkills });
      }
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
