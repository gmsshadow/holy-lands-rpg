# Holy Lands RPG - Combat System Guide

## Initiative (Advantage System)

Holy Lands RPG uses an **Advantage system** instead of traditional initiative:

1. At the start of each combat round, all combatants roll **Advantage** (1d20 + Advantage Bonus)
2. The highest roll wins and acts first
3. Ties are broken by **Agility** attribute (higher goes first)

### How to Use in Foundry

1. **Start Combat**: Click the crossed swords icon to create an encounter
2. **Add Combatants**: Drag tokens to the combat tracker
3. **Roll Advantage**: Click "Roll Initiative" or "Roll All"
   - The system automatically rolls 1d20 + Advantage Bonus for each combatant
   - Chat messages show each roll
   - Turn order is determined by highest to lowest

### Advantage Bonus

Set your character's Advantage Bonus in the **Combat** tab:
- Located under "Combat Bonuses" section
- Base value is 0
- Modified by skills, blessings, and class abilities

## Actions per Round (AtR)

Each weapon skill has **AtR** (Attacks per Round):
- **atRMax**: Maximum actions per round (typically 1-2)
- **atRCurrent**: Current actions remaining this round

### AtR Management

**Automatic Reset:**
- AtR is automatically reset to maximum at the start of each new combat round
- Triggered when you click "Next Round" in the combat tracker

**Manual AtR Consumption:**
- Each attack automatically consumes 1 AtR
- Taking damage consumes 1 AtR (simulating defensive reactions)
- If AtR reaches 0, you cannot attack until next round

### Checking AtR

View your remaining AtR in the **Combat** tab under **Weapon Skills**:
```
Light Arms
  Attack Bonus: +2
  AtR: 2/2  ← Current / Maximum
```

## Combat Bonuses

Located in the **Combat** tab:

- **Advantage Bonus**: Added to initiative (Advantage) rolls
- **Dodge Bonus**: Added to Dodge defense rolls
- **Defend Bonus**: Added to Defend (block/parry) defense rolls
- **Damage Bonus**: Added to all damage rolls after multipliers

## Defense System

### Natural Defense (nDEF)
- Base defense value (typically 4)
- Set in template, rarely changes

### Armor Defense by AP (aDEFByAP)
- Defense provided by equipped armor
- Calculated per body location (Head, Chest, Arms, Legs, Back, Feet)
- **Automatically calculated** from equipped armor

### Total Defense (tDEF)
- **tDEF = nDEF + aDEFTotal**
- This is your "Armor Class" - attacks must beat this to proceed
- Updated automatically when you equip/unequip armor

### Armor Penalty
- Heavy armor slows you down
- Shown as "Armor Penalty Total"
- Applied to relevant actions at GM discretion

## Attack Sequence

### 1. Attacker Rolls Attack
Click the **attack icon** (⚔️) on your weapon:
- System prompts you to select a target
- Rolls 1d20 + Attack Bonus
- Compares to target's **tDEF**

**Gate A Check:**
- If Attack ≤ tDEF → Attack fails immediately
- If Attack > tDEF → Proceeds to defender's action

### 2. Defender Chooses Defense
If attack passes Gate A, defender is prompted:
- **Dodge**: Roll 1d20 + Dodge Bonus (evade the attack)
- **Defend**: Roll 1d20 + Defend Bonus (block with weapon/shield)

### 3. Resolution
Compare Attack roll vs Defense roll:
- **Defense ≥ Attack**: Attack blocked/dodged
  - Defender can counter-attack if they have AtR remaining
- **Attack > Defense**: Hit! Roll damage

### 4. Damage
Click the **damage icon** (🎲) on your weapon:
- Rolls weapon damage dice
- Adds Damage Bonus (from Combat tab)
- On Natural 20 attack: ×2 damage
- On Natural 1 defense: ×1.5 damage

### 5. Armor Degradation
Armor wears down during combat:
- Damage ≥ CAP (Capacity): Armor loses 1 aDEF per CAP threshold
- Displayed as `currentADEF` on armor items
- When aDEF reaches 0, armor loses PEN (penalty)
- System automatically recalculates tDEF

## Special Combat Rules

### Natural 20 (Attack)
- **Automatic hit** (bypasses defense entirely in some cases)
- Damage is **doubled** (×2)
- Roll damage as normal, then multiply result

### Natural 1 (Attack)
- **Automatic failure**
- Attacker's **halfDefenseFlag** is set to true
- On their next defense, they roll at half effectiveness

### Natural 20 (Defense)
- **Automatic success** (attack blocked)
- Defender gains a **free counter-attack**
- Counter-attack doesn't consume AtR

### Natural 1 (Defense)
- **Automatic failure** (hit guaranteed)
- Damage is multiplied by **×1.5**

### Half Defense Flag
When you critically fail an attack (Natural 1):
- `halfDefenseFlag` is set on your character
- Your next defense roll is halved
- Flag is cleared after one defense roll

## Combat Tracker Tips

### Roll Advantage Manually
If you want to roll Advantage outside the combat tracker:
1. Use a macro: `/roll 1d20 + @combat.advantageBonus`
2. Or use the character sheet Combat tab buttons (if implemented)

### Reroll Advantage
1. Click "Reset Initiative" to clear all rolls
2. Click "Roll All" to roll again
3. Useful for new rounds if you want fresh initiative

### Delayed Turn
Right-click a combatant → "Delay Turn" to act later in the round

### AtR Tracking
Watch your AtR carefully:
- Each attack consumes 1 AtR
- Taking damage consumes 1 AtR
- Counter-attacks (after successful defense) don't consume AtR
- Resets automatically at start of next round

## Quick Reference

| Roll | Die | Bonus From | When |
|------|-----|------------|------|
| **Advantage** | d20 | Advantage Bonus | Start of round (initiative) |
| **Attack** | d20 | Attack Bonus (by weapon type) | Your turn, if you have AtR |
| **Dodge** | d20 | Dodge Bonus | When attacked |
| **Defend** | d20 | Defend Bonus | When attacked |
| **Damage** | Varies | Damage Bonus + STR | After successful hit |

## Troubleshooting

**Initiative not rolling:**
- Check that combatants have an Advantage Bonus set (default: 0)
- Ensure Combat document class is registered

**AtR not resetting:**
- Verify you're clicking "Next Round" not "Next Turn"
- Check browser console for errors
- AtR resets happen automatically via hooks

**Defense not calculating:**
- Make sure armor items are marked as "equipped"
- Check that armor has correct AP (armor placement) set
- Refresh character sheet to recalculate

**Attacks not working:**
- Ensure weapon has a Weapon Skill type set
- Check that character has AtR remaining
- Verify target is a valid actor (not just a token)

## GM Tips

1. **Advantage Modifiers**: Award +1 to +3 bonuses for tactical advantage (high ground, surprise, etc.)
2. **Simultaneous Attack**: Let players forfeit Advantage to attack simultaneously (both roll attacks, both roll defenses)
3. **AtR Management**: Remind players to check AtR before declaring actions
4. **Armor Repair**: Between encounters, reset `currentADEF` and `currentPEN` to base values (represent repairs)
5. **Speed Up Combat**: For simple encounters, skip defender choice and default to Defend

---

**For more details, consult Holy Lands RPG Trinity Book 1: Genesis, Chapter 5: Combat**
