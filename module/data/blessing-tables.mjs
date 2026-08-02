/**
 * Blessing tables by type (Genesis p.61). Each entry: [lo, hi, name].
 * Roll d% (0-99); the range containing the roll gives the Blessing.
 */
export const BLESSING_TABLES = {
  "courage": [
    [
      0,
      2,
      "Adjust Attack"
    ],
    [
      3,
      5,
      "Adjust Critical"
    ],
    [
      6,
      7,
      "Adjust Gifts"
    ],
    [
      8,
      10,
      "Adjust Special"
    ],
    [
      11,
      13,
      "Adjust Talents"
    ],
    [
      14,
      14,
      "Attack Effect"
    ],
    [
      15,
      15,
      "Blessed Attack"
    ],
    [
      16,
      16,
      "Blessed Critical"
    ],
    [
      17,
      20,
      "Critical Grace"
    ],
    [
      21,
      22,
      "Damage Grace"
    ],
    [
      23,
      25,
      "Extended Critical"
    ],
    [
      26,
      26,
      "Gain Advantage"
    ],
    [
      27,
      30,
      "Heightened Advantage"
    ],
    [
      31,
      33,
      "Heightened Attack"
    ],
    [
      34,
      36,
      "Heightened Critical"
    ],
    [
      37,
      39,
      "Heightened Damage"
    ],
    [
      40,
      43,
      "Heightened Skill"
    ],
    [
      44,
      45,
      "Holy War Cry"
    ],
    [
      46,
      48,
      "Immunity: Fright"
    ],
    [
      49,
      50,
      "Momentum Attack"
    ],
    [
      51,
      53,
      "Peak Advantage"
    ],
    [
      54,
      55,
      "Peak Critical"
    ],
    [
      56,
      57,
      "Peak Saving Throw"
    ],
    [
      58,
      60,
      "Peak Special"
    ],
    [
      61,
      62,
      "Penetrating Attack"
    ],
    [
      63,
      64,
      "Power Attack"
    ],
    [
      65,
      66,
      "Power Critical"
    ],
    [
      67,
      67,
      "Power Damage"
    ],
    [
      68,
      70,
      "Power Finish"
    ],
    [
      71,
      71,
      "Power Skill"
    ],
    [
      72,
      73,
      "Power Special"
    ],
    [
      74,
      75,
      "Selective Advantage"
    ],
    [
      76,
      77,
      "Selective Attack"
    ],
    [
      78,
      79,
      "Selective Attribute"
    ],
    [
      80,
      80,
      "Selective Critical"
    ],
    [
      81,
      85,
      "Special Grace"
    ],
    [
      86,
      88,
      "Stepped Advantage"
    ],
    [
      89,
      92,
      "Stepped Critical"
    ],
    [
      93,
      95,
      "Stepped Skill"
    ],
    [
      96,
      99,
      "Stepped Special"
    ]
  ],
  "duty": [
    [
      0,
      4,
      "Advantage Grace"
    ],
    [
      5,
      8,
      "Battle Alertness"
    ],
    [
      9,
      11,
      "Battle Consciousness"
    ],
    [
      12,
      12,
      "Blessed Defend"
    ],
    [
      13,
      15,
      "Blessed Defensive"
    ],
    [
      16,
      16,
      "Blessed Saving Throw"
    ],
    [
      17,
      20,
      "Defend Grace"
    ],
    [
      21,
      22,
      "Gift Proficiency"
    ],
    [
      23,
      25,
      "Heightened Defend"
    ],
    [
      26,
      28,
      "Heightened Dodge"
    ],
    [
      29,
      30,
      "Immunity: Curses"
    ],
    [
      31,
      31,
      "Immunity: Disease"
    ],
    [
      32,
      33,
      "Immunity: Poison"
    ],
    [
      34,
      35,
      "Immunity: Rune Circles"
    ],
    [
      36,
      38,
      "Miss"
    ],
    [
      39,
      41,
      "Peak Defend"
    ],
    [
      42,
      44,
      "Peak Dodge"
    ],
    [
      45,
      46,
      "Power Defend"
    ],
    [
      47,
      47,
      "Power Dodge"
    ],
    [
      48,
      50,
      "Power Retreat"
    ],
    [
      51,
      53,
      "Quick Pull"
    ],
    [
      54,
      56,
      "Resist Curse"
    ],
    [
      57,
      58,
      "Resist Disease"
    ],
    [
      59,
      61,
      "Resist Fright"
    ],
    [
      62,
      64,
      "Resist Fumes/Acids"
    ],
    [
      65,
      68,
      "Resist Miracles/Holy Items"
    ],
    [
      69,
      70,
      "Resist Rune Circles"
    ],
    [
      71,
      72,
      "Resist Spells/Magic Items"
    ],
    [
      73,
      73,
      "Resist Using Magic"
    ],
    [
      74,
      76,
      "Saving Throw Grace"
    ],
    [
      77,
      78,
      "Selective Ability"
    ],
    [
      79,
      80,
      "Selective Defend"
    ],
    [
      81,
      81,
      "Selective Dodge"
    ],
    [
      82,
      83,
      "Selective Saving Throw"
    ],
    [
      84,
      85,
      "Sidestep"
    ],
    [
      86,
      89,
      "Skill Grace"
    ],
    [
      90,
      91,
      "Spell Reckoning"
    ],
    [
      92,
      95,
      "Stepped Defend"
    ],
    [
      96,
      98,
      "Stepped Dodge"
    ],
    [
      99,
      99,
      "Sway Death"
    ]
  ],
  "fortune": [
    [
      0,
      4,
      "Ability Grace"
    ],
    [
      5,
      7,
      "Adjust Abilities"
    ],
    [
      8,
      9,
      "Adjust Attributes"
    ],
    [
      10,
      11,
      "Adjust Combat Abilities"
    ],
    [
      12,
      15,
      "Adjust Crafts"
    ],
    [
      16,
      17,
      "Adjust Saving Throws"
    ],
    [
      18,
      21,
      "Attack Grace"
    ],
    [
      22,
      23,
      "Blessed Ability"
    ],
    [
      24,
      25,
      "Blessed Attribute"
    ],
    [
      26,
      27,
      "Blessed Healing"
    ],
    [
      28,
      28,
      "Blessed Skill"
    ],
    [
      29,
      29,
      "Blessed Special"
    ],
    [
      30,
      30,
      "Blind Fight"
    ],
    [
      31,
      33,
      "Dodge Grace"
    ],
    [
      34,
      37,
      "Enhanced Flank"
    ],
    [
      38,
      39,
      "Focused Attack"
    ],
    [
      40,
      42,
      "Heightened Saving Throw"
    ],
    [
      43,
      45,
      "Heightened Special"
    ],
    [
      46,
      47,
      "Immunity: Fumes/Acids"
    ],
    [
      48,
      50,
      "Immunity: Miracles/Holy Items"
    ],
    [
      51,
      51,
      "Immunity: Spells/Magic Items"
    ],
    [
      52,
      52,
      "Immunity: Using Magic"
    ],
    [
      53,
      56,
      "Negate Critical Failures"
    ],
    [
      57,
      59,
      "Peak Attack"
    ],
    [
      60,
      61,
      "Peak Damage"
    ],
    [
      62,
      64,
      "Peak Skill"
    ],
    [
      65,
      67,
      "Power Advantage"
    ],
    [
      68,
      70,
      "Power Saving Throw"
    ],
    [
      71,
      71,
      "Resist Death"
    ],
    [
      72,
      73,
      "Resist Poison"
    ],
    [
      74,
      76,
      "Rune Delay"
    ],
    [
      77,
      78,
      "Salvage Finish"
    ],
    [
      79,
      81,
      "Second Wind"
    ],
    [
      82,
      82,
      "Selective Skill"
    ],
    [
      83,
      84,
      "Selective Special"
    ],
    [
      85,
      87,
      "Stepped Attack"
    ],
    [
      88,
      91,
      "Stepped Saving Throws"
    ],
    [
      92,
      94,
      "Strength of Mind"
    ],
    [
      95,
      96,
      "Strong Attack"
    ],
    [
      97,
      99,
      "Talent Proficiency"
    ]
  ]
};

/** Class key -> blessing table (Genesis Ch7 class descriptions). */
export const CLASS_BLESSING_TABLE = {
  "adventurer": "fortune",
  "bard": "duty",
  "cleric": "duty",
  "devilHunter": "courage",
  "fighter": "courage",
  "jester": "fortune",
  "knight": "courage",
  "saint": "duty",
  "saisier": "courage",
  "scout": "fortune",
  "spy": "fortune",
  "voyager": "fortune",
  "warrior": "fortune"
};

/** Look up a Blessing name from a table by a d% roll (0-99). */
export function blessingFromRoll(tableKey, roll) {
  const table = BLESSING_TABLES[tableKey];
  if (!table) return null;
  for (const [lo, hi, name] of table) {
    if ((roll >= lo) && (roll <= hi)) return name;
  }
  return null;
}
