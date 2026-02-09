# Holy Lands RPG - Foundry VTT System

A complete game system implementation for **Holy Lands RPG: Trinity - Book 1: Genesis** in Foundry Virtual Tabletop.

## About Holy Lands RPG

Holy Lands RPG is a Christian-themed tabletop role-playing game set in medieval times. Players take on the roles of faithful adventurers who rely on their faith in God and their personal virtues to overcome challenges. The system emphasizes moral choices, spiritual growth, and cooperative storytelling within a framework that honors Christian values.

## Features

### Character Creation & Management
- **12 Attributes**: Intellect, Wisdom, Patience, Will, Memory, Strength, Agility, Speed, Endurance, Beauty, Charisma, and Virtue
- **7 Abilities**: Calculated from attribute combinations (Perception, Search, Climb, Jump, Balance, Hide, Appeal)
- **13 Character Classes**: Adventurer, Bard, Cleric, Devil Hunter, Fighter, Jester, Knight, Saint, Saisier, Scout, Spy, Voyager, and Warrior
- **4 Statures**: WeeFolk, Dwarfolk, CommonFolk, and GiantFolk
- **Skills System**: Gifts (strongest), Talents (medium), and Crafts (learning skills)
- **Weapon Skills**: Light Arms, Heavy Arms, Missile, and Thrown weapons

### Core Mechanics
- **Life & Faith**: Track both physical health and spiritual power
- **Attribute Rolls**: Roll d12 under attribute value (lower is better)
- **Ability/Skill Rolls**: Roll d20 + modifier vs. Difficulty Factor (higher is better)
- **Saving Throws**: Six types - Death, Poison, Disease, Magic, Fear, and Sin
- **Critical Rolls**: Natural 20s and 1s have special effects
- **Grace Effect**: Option to reroll natural 1s during character creation

### Combat System
- **Weapon Skills**: Attack, Parry, Critical, and Special bonuses by weapon type
- **Defense & Armor Rating**: Track character defenses
- **Initiative**: Determines turn order in combat
- **Attack & Damage Rolls**: Click-to-roll functionality

### Faith-Based Powers
- **Miracles**: Supernatural abilities powered by Faith points
  - High Miracles
  - Clerical Miracles
  - Customizable Faith Cost, Range, Duration, and Target
- **Blessings**: Permanent or long-lasting divine benefits

### Equipment Management
- **Weapons**: Track damage, weapon skill type, range, and properties
- **Armor**: Armor Rating and body placement (Head, Chest, Arms, Legs, Feet, Back)
- **Equipment**: General items with quantity and weight tracking
- **Currency**: Gold and silver pieces (1 gold = 30 silver)

## Installation

### Manual Installation

1. Download this repository as a ZIP file
2. Extract the contents to your Foundry VTT `Data/systems/` folder
3. Rename the extracted folder to `holy-lands-rpg`
4. Restart Foundry VTT
5. Create a new world and select "Holy Lands RPG" as the game system

### File Structure
```
holy-lands-rpg/
├── system.json                 # System manifest
├── template.json              # Data model definitions
├── module/
│   ├── holy-lands.mjs        # Main system module
│   ├── documents/
│   │   ├── actor.mjs         # Actor document class
│   │   └── item.mjs          # Item document class
│   └── sheets/
│       ├── actor-sheet.mjs   # Character/NPC sheet
│       └── item-sheet.mjs    # Item sheet
├── templates/
│   ├── actor/
│   │   ├── actor-character-sheet.hbs
│   │   └── actor-npc-sheet.hbs
│   └── item/
│       ├── item-weapon-sheet.hbs
│       ├── item-armor-sheet.hbs
│       ├── item-equipment-sheet.hbs
│       ├── item-miracle-sheet.hbs
│       ├── item-blessing-sheet.hbs
│       └── item-skill-sheet.hbs
├── styles/
│   └── holy-lands.css        # System styling
└── lang/
    └── en.json               # English translations
```

## Usage

### Creating a Character

1. Create a new Actor and select "Character" type
2. Fill in basic information:
   - Name, Class, Stature
   - Age and Gender
3. Roll or set Attributes (12 attributes ranging from 3-16 typically)
4. Abilities are automatically calculated from attributes
5. Add starting skills (Gifts, Talents, and Crafts)
6. Distribute Weapon Skill bonuses
7. Add starting equipment, weapons, and armor
8. For faith-based classes, add Miracles and Blessings

### Rolling Dice

#### Attribute Checks (d12, roll under)
Click the dice icon next to any attribute to roll d12. Success if result ≤ attribute value.
- Natural 1 = Critical Success
- Natural 12 = Critical Failure

#### Ability/Skill Checks (d20 + bonus)
Click the dice icon next to abilities or skills. You'll be prompted for a Difficulty Factor (DF).
- Roll d20 + proficiency modifier
- Success if result ≥ DF
- Natural 20 = Critical Success
- Natural 1 = Critical Failure

#### Saving Throws
Click the dice icon next to any saving throw and enter the DF.
- Roll d20 + save bonus
- Success if result ≥ DF

#### Combat
- **Attack**: Click the attack icon on a weapon to roll d20 + attack bonus
- **Damage**: Click the damage icon to roll weapon damage + STR modifier
- **Hold Shift** when clicking damage to roll critical damage (2x)

### Using Miracles and Blessings

1. Add Miracles or Blessings to your character
2. Set Faith Cost for miracles
3. Click the miracle/blessing icon to use:
   - Miracles deduct Faith Cost automatically
   - Description is posted to chat for GM and players

### Managing Equipment

- Click the **+** icon in any equipment section to create new items
- Drag items between actors to transfer
- Click the trash icon to delete items
- Check "Equipped" on weapons and armor currently in use

## System Settings

Access in the Game Settings menu:

- **Use Grace Effect**: Enable rerolling natural 1s during attribute generation (default: on)
- **Use Critical Rolls**: Enable critical successes and failures on natural 20s and 1s (default: on)

## Dice Mechanics

### Common Rolls
- **Attribute Rolls**: d12 (low) - roll under attribute value
- **Ability Rolls**: d20 (high) - roll over difficulty factor
- **Skill Rolls**: d20 (high) - roll over difficulty factor
- **Saving Throws**: d20 (high) - roll over difficulty factor
- **Combat Rolls**: d20 (high) - attack vs. defense

### Difficulty Factors (DF)
The Raconteur (GM) sets difficulty:
- 5-9: Easy
- 10-14: Moderate
- 15-19: Hard
- 20+: Very Hard

## Character Classes

### WeeFolk Classes
Adventurer, Bard, Fighter, Jester, Saint, Scout, Spy, Voyager

### Dwarfolk Classes
Adventurer, Cleric, Devil Hunter, Fighter, Knight, Warrior

### CommonFolk Classes
All classes available

### GiantFolk Classes
Adventurer, Fighter, Knight, Warrior

## Support & Resources

- **Official Website**: https://www.holylandsrpg.com
- **Foundry VTT**: Requires version 11 or higher (verified through v12)

## Credits

**Holy Lands RPG** created by Faith Quest Games
- Game Design: Faith Quest Games
- System Implementation: Created for Foundry VTT

This is an unofficial fan-made implementation for use with Foundry Virtual Tabletop. Holy Lands RPG and all related content are © Faith Quest Games. This system is provided for personal use only.

## Version History

### 1.0.0 (Initial Release)
- Complete character sheet with all 12 attributes
- 7 abilities with automatic calculation
- Skills system (Gifts, Talents, Crafts)
- Weapon skills with Attack, Parry, Critical, and Special
- Combat system with Initiative, Defense, and Armor Rating
- Miracles and Blessings with Faith cost tracking
- Equipment management (weapons, armor, equipment)
- Currency tracking (gold and silver)
- Saving throws system
- Click-to-roll functionality for all checks
- Critical success/failure detection
- Grace Effect for attribute generation
- NPC sheet for simplified enemy tracking

## License

This system is provided as-is for personal use with Foundry VTT. Holy Lands RPG is a registered trademark of Faith Quest Games. All game content and intellectual property belong to Faith Quest Games.
